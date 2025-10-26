import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(bodyParser.json());

export const client = new OpenAI({
	apiKey: "AIzaSyCVOD5uNgeO8sYm1EC86Ejq29L83R0Y-eo",
	baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

app.post("/chat", async (req, res) => {
	const { message } = req.body;
	try {
		const response = await client.chat.completions.create({
			model: "gemini-2.0-flash",
			messages: [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: message },
			],
		});
		return res.json({ reply: response.choices[0].message.content });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Error calling Gemini API" });
	}
});

app.listen(3000, () => console.log("✅ Gemini API proxy running at http://localhost:3000"));
