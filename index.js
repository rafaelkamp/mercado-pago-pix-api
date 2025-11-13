import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN, // Definido no Render
});

app.post("/api/mercadoPagoCreatePix", async (req, res) => {
  try {
    const { amount, description, payer } = req.body;

    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description,
      payment_method_id: "pix",
      payer,
    });

    res.status(200).json({
      success: true,
      qr_code: payment.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        payment.point_of_interaction.transaction_data.qr_code_base64,
    });
  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("API Mercado Pago PIX funcionando ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
