import { OpenAI } from "openai"
import "dotenv/config" //agora todas as variáveis inseridas no .env serão inseridas dentro do process.env.OPENAI_KEY

export const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
})