const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const router = express.Router();

const getTimeStamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const getPassword = (timeStamp) => {
  const shortCode = process.env.BUSINESS_SHORT_CODE;
  const passKey = process.env.PASS_KEY;
  const password = `${shortCode}${passKey}${timeStamp}`;
  return Buffer.from(password).toString("base64");
};

const getAccessToken = async () => {
  try {
    const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
    const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString("base64");

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`, // Fixed syntax
      },
    });
    console.log(response.data.access_token)
    return ;
  } catch (err) {
    console.error("Error getting access token:", err.response?.data || err.message);
    throw err;
  }
};

router.post("/stk-push", async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;
    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: "Phone number and amount are required" });
    }

    // Validate phone number
    let formattedPhone = phoneNumber.replace(/\D/g, ""); // Remove non-digits
    if (formattedPhone.startsWith("0")) {
      formattedPhone = `254${formattedPhone.slice(1)}`;
    } else if (formattedPhone.startsWith("+254")) {
      formattedPhone = formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      return res.status(400).json({ error: "Invalid phone number format. Use 07xxxxxxxx or +2547xxxxxxxx" });
    }

    // Validate amount
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const accessToken = await getAccessToken();
    const timeStamp = getTimeStamp();
    const password = getPassword(timeStamp); // Pass timeStamp
    const shortCode = process.env.BUSINESS_SHORT_CODE;

    const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
    const data = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timeStamp, // Fixed key name
      TransactionType: "CustomerPayBillOnline",
      Amount: parsedAmount,
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone, // Fixed key name
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "Test Payment",
      TransactionDesc: "Test Payment", // Fixed key name
    };

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${accessToken}`, // Fixed typo
        "Content-Type": "application/json",
      },
    });

    return res.json({
      success: true,
      message: "STK Push initiated successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Error initiating STK Push:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate STK Push",
      error: error.response?.data || error.message,
    });
  }
});

router.post("/callback", (req, res) => {
  const callbackData = req.body?.Body?.stkCallback;

  if (!callbackData) {
    console.error("Invalid callback data received");
    return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback data" });
  }

  console.log("STK Callback response:", JSON.stringify(req.body, null, 2));

  if (callbackData.ResultCode === 0) {
    const metadata = callbackData.CallbackMetadata?.Item || [];
    const transactionId = metadata.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
    const amount = metadata.find((item) => item.Name === "Amount")?.Value;
    const phone = metadata.find((item) => item.Name === "PhoneNumber")?.Value;

    console.log(`Payment successful: Transaction ID ${transactionId}, Amount ${amount}, Phone ${phone}`);
    // TODO: Update database, fulfill order, notify customer
  } else {
    console.log("Payment failed:", callbackData.ResultDesc);
    // TODO: Handle failure (e.g., notify user, log error)
  }

  // Acknowledge callback to M-Pesa
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

app.use("/api/mpesa", router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});