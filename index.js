import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";
import fetch from "node-fetch"; // usado para chamar API do Base44

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Configuração Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ✅ Geração de PIX
app.post("/api/mercadoPagoCreatePix", async (req, res) => {
  try {
    const {
      amount,
      description,
      payer,
      lessonId,
      instructorId,
      platformFee,
      instructorAmount,
    } = req.body;

    console.log("=== Criando PIX Mercado Pago ===", {
      amount,
      description,
      payer,
      lessonId,
      instructorId,
    });

    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description: description || "Pagamento via PIX",
      payment_method_id: "pix",
      payer: {
        email: payer.email,
        first_name: payer.first_name || "Cliente",
        last_name: payer.last_name || "App Base44",
      },
      notification_url: "https://mercado-pago-pix-api.onrender.com/api/webhook", // 👈 webhook automático
    });

    const poi =
      payment.point_of_interaction ||
      payment.response?.point_of_interaction ||
      payment.body?.point_of_interaction;

    const txData = poi?.transaction_data;

    res.status(200).json({
      success: true,
      payment_id:
        payment.id ||
        payment.response?.id ||
        payment.body?.id ||
        null,
      qr_code: txData.qr_code,
      qr_code_base64: txData.qr_code_base64,
      amount: payment.transaction_amount || amount,
      status: payment.status || "pending",
      expiration_date: payment.date_of_expiration || null,
    });
  } catch (error) {
    console.error("❌ Erro ao criar PIX:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Consulta de status manual (opcional)
app.get("/api/mercadoPagoStatus/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = await mercadopago.payment.findById(paymentId);
    res.status(200).json({
      success: true,
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      date_approved: payment.date_approved,
    });
  } catch (error) {
    console.error("Erro ao consultar status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Novo: Webhook Mercado Pago
app.post("/api/webhook", async (req, res) => {
  try {
    const { action, data } = req.body;
    console.log("📩 Webhook recebido:", action, data);

    if (action !== "payment.created" && action !== "payment.updated") {
      return res.status(200).send("Ignorado (não é evento de pagamento)");
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(400).send("Sem ID de pagamento");
    }

    // 🔍 Consulta detalhes do pagamento no Mercado Pago
    const payment = await mercadopago.payment.findById(paymentId);
    console.log("🔎 Detalhes do pagamento:", payment.status);

    // ✅ Atualiza status no Base44 via API REST
    const updateResponse = await fetch("https://api.base44.com/entities/Payment/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BASE44_API_KEY}`,
      },
      body: JSON.stringify({
        filter: { transaction_id: String(paymentId) },
        update: { status: payment.status === "approved" ? "completed" : payment.status },
      }),
    });

    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      console.error("❌ Falha ao atualizar Base44:", text);
    } else {
      console.log("✅ Status atualizado no Base44 para:", payment.status);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Erro no webhook:", error);
    res.status(500).send("Erro interno");
  }
});

// ✅ Teste rápido
app.get("/", (req, res) => res.send("🚀 API Mercado Pago PIX com Webhook ativa!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
