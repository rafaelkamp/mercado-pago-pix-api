import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

if (!process.env.MP_ACCESS_TOKEN) {
  console.error("MP_ACCESS_TOKEN não definido!");
}

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

app.post("/api/mercadoPagoCreatePix", async (req, res) => {
  try {
    const { amount, description, payer } = req.body;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "amount inválido" });
    }
    if (!payer || !payer.email) {
      return res.status(400).json({ success: false, message: "payer.email é obrigatório" });
    }

    // Chamada ao Mercado Pago
    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description: description || "Pagamento via PIX",
      payment_method_id: "pix",
      payer,
    });

    // Log completo para depuração (Render logs)
    console.log("Resposta MP (raw):", JSON.stringify(payment, null, 2));

    // Tentar localizar o campo esperado de forma segura
    const poi =
      payment &&
      (payment.point_of_interaction ||
        payment.response?.point_of_interaction ||
        payment.body?.point_of_interaction);

    const txData =
      poi &&
      (poi.transaction_data || poi.transaction_data || poi?.transaction_data);

    if (txData && txData.qr_code) {
      return res.status(200).json({
        success: true,
        qr_code: txData.qr_code,
        qr_code_base64: txData.qr_code_base64 || null,
        raw: payment, // opcional: remove em produção
      });
    }

    // Se não achou o transaction_data, devolve o objeto para debug
    return res.status(500).json({
      success: false,
      message: "Campo transaction_data não encontrado na resposta do Mercado Pago",
      debug: {
        received: payment,
      },
    });
  } catch (error) {
    // Log detalhado do erro (Render logs)
    console.error("Erro ao criar PIX (catch):", error);

    // Mercado Pago SDK pode devolver erros de formas variadas
    const errInfo = {
      message: error.message,
      cause: error.cause || null,
      response: error.response || error.error || null,
    };

    return res.status(500).json({
      success: false,
      message: "Erro interno ao chamar Mercado Pago",
      error: errInfo,
    });
  }
});

app.get("/", (req, res) => {
  res.send("API Mercado Pago PIX funcionando ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
