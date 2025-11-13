import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Configuração do Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN, // Defina essa variável no Render
});

// ✅ Endpoint para gerar PIX
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
        email: payer?.email || "sem-email@app.com",
        first_name: payer?.first_name || "Usuário",
        last_name: payer?.last_name || "Base44",
      },
      notification_url: "https://api.base44.com/webhooks/mercadopago/68f0f736d119a95c992109cf", // 👈 Webhook oficial do Base44
    });

    const poi =
      payment.point_of_interaction ||
      payment.response?.point_of_interaction ||
      payment.body?.point_of_interaction;

    const txData = poi?.transaction_data;

    if (!txData) {
      console.error("❌ Nenhum transaction_data retornado pelo Mercado Pago");
      return res.status(500).json({
        success: false,
        message: "Falha ao gerar PIX — dados incompletos.",
      });
    }

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

// ✅ Endpoint para consultar status do pagamento (usado pelo Base44)
app.post("/api/checkPaymentStatus", async (req, res) => {
  try {
    const { payment_id } = req.body;
    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "payment_id é obrigatório",
      });
    }

    console.log("🔍 Consultando status do pagamento no Mercado Pago:", payment_id);

    const payment = await mercadopago.payment.findById(payment_id);

    if (!payment || !payment.id) {
      console.warn("⚠️ Pagamento não encontrado:", payment_id);
      return res.status(404).json({
        success: false,
        message: "Pagamento não encontrado",
      });
    }

    res.status(200).json({
      success: true,
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      date_approved: payment.date_approved,
    });
  } catch (error) {
    console.error("❌ Erro ao verificar status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Rota básica para teste
app.get("/", (req, res) => {
  res.send("🚀 API Mercado Pago PIX está ativa e rodando!");
});

// ✅ Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Servidor rodando na porta ${PORT}`)
);
