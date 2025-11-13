import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Configuração do Mercado Pago
if (!process.env.MP_ACCESS_TOKEN) {
  console.error("⚠️ MP_ACCESS_TOKEN não definido! Configure nas variáveis do Render.");
}

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ✅ Endpoint principal da API PIX
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

    console.log("=== Criando PIX Mercado Pago ===");
    console.log("Valor:", amount);
    console.log("Descrição:", description);
    console.log("Pagador:", payer?.email);
    console.log("Lesson ID:", lessonId);
    console.log("Instructor ID:", instructorId);

    // 🔍 Validações básicas
    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "Valor (amount) inválido" });
    }
    if (!payer?.email) {
      return res.status(400).json({ success: false, message: "E-mail do pagador é obrigatório" });
    }

    // 💰 Criação do pagamento PIX
    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description: description || "Pagamento via PIX",
      payment_method_id: "pix",
      payer: {
        email: payer.email,
        first_name: payer.first_name || "Cliente",
        last_name: payer.last_name || "App Base44",
      },
    });

    console.log("✅ PIX criado com sucesso no Mercado Pago!");
    console.log("Resposta MP (raw):", JSON.stringify(payment, null, 2));

    // 🔍 Captura segura dos dados retornados
    const poi =
      payment.point_of_interaction ||
      payment.response?.point_of_interaction ||
      payment.body?.point_of_interaction;

    const txData = poi?.transaction_data;

    if (!txData || !txData.qr_code) {
      console.error("❌ Resposta inesperada do Mercado Pago:", payment);
      return res.status(500).json({
        success: false,
        message: "Campo transaction_data não encontrado na resposta do Mercado Pago",
        debug: { received: payment },
      });
    }

    // ✅ Retorno da API para o app Base44
    res.status(200).json({
      success: true,
      payment_id:
        payment.id ||
        payment.response?.id ||
        payment.body?.id ||
        null, // 🔥 Adiciona o payment_id que o Base44 espera
      qr_code: txData.qr_code,
      qr_code_base64: txData.qr_code_base64,
      amount: payment.transaction_amount || amount,
      status: payment.status || "pending",
      ticket_url: txData.ticket_url || null,
      expiration_date: payment.date_of_expiration || null,
      platform_fee: platformFee || null,
      instructor_amount: instructorAmount || null,
    });
  } catch (error) {
    console.error("❌ Erro ao criar PIX:", error);

    const errMsg =
      error?.message ||
      error?.response?.message ||
      "Erro desconhecido ao processar PIX";

    return res.status(500).json({
      success: false,
      message: errMsg,
      error: {
        message: error.message,
        cause: error.cause || null,
        response: error.response || error.error || null,
      },
    });
  }
});

// ✅ Endpoint simples para teste
app.get("/", (req, res) => {
  res.send("✅ API Mercado Pago PIX funcionando corretamente!");
});

// 🚀 Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
