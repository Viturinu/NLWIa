import { FastifyInstance } from "fastify";
import { fastifyMultipart } from "@fastify/multipart"
import { prisma } from "../lib/prisma";
import fs, { createReadStream } from "node:fs"
import { pipeline } from "node:stream"
import path from "node:path"; //pra gente buscar o caminho do arquivo enviado; Assim sabemos quando vem do node, ou de algum pacote instalado via npm ou pnpm
import { randomUUID } from "node:crypto"; //pra gerarmos um id aleatório; outro módulo interno do node
import { promisify } from "node:util"
import { z } from "zod"
import { openai } from "../lib/openai";
import {streamToResponse, OpenAIStream} from "ai"

const pump = promisify(pipeline) //node tem um grande diferencial que é de trabalhar com streaming (formas de ler dados ou escrever dados aos poucos); ou seja, chegou um pedaço for arquivo, ao invés de alocar em memoria ram, já vamos escrevendo ele em disco
//daí vem o pipeline, processo de upload total, que utiliza de uma biblioteca antiga, por isso utilizados a função promisify para conseguirmos utilizar async e await e fazermos via promise.
export async function videosRoute(app: FastifyInstance) {

    app.register(fastifyMultipart, {
        limits: {
            fileSize: 1_048_576 * 25 //25mb - Pois, conforme documentação, valor default pra esse multipart-limits-filesize é de 1048576 (não tem problema colocar underline nas unidades de milhares)
        }
    })

    app.post("/videos", async (request, reply) => {
        const data = await request.file();
        if (!data) {
            return reply.status(400).send(
                {
                    error: "Missing file input"
                })
        }

        const extension = path.extname(data.filename) //importações de modulos que de algum modo são internas do node (path, fs, crypto, http, util, stream), a gente precisa 

        if (extension != ".mp3") {
            return reply.status(400).send({
                error: "Invalid input type.  Please upload a MP3"
            })
        }

        const fileBaseName = path.basename(data.filename, extension) //mudar os nomes, pois podem vir nomes iguais em arquivos de pessoas diferentes, por isso criamos o nome dele no fileBaseName e alteramos
        const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}` //nome criado com UUID diferente, para evitar problemas com vídeos repetidos
        const uploadDestination = path.resolve(__dirname, "../../tmp", fileUploadName) //pegando diretorio desejado para despejo de file e colocando junto com nome do arquivo

        await pump(data.file, fs.createWriteStream(uploadDestination)) //primeiro parametro recebemos o upload do arquivo e o segundo é onde acontece a escrita deste arquivo, pouco a pouco, via streaming

        const video = await prisma.video.create({
            data: {
                name: data.filename,
                path: uploadDestination,
            }
        })

        return {
            video,
        }

    })

    app.post("/videos/:videoId/transcription", async (request, reply) => { //onde acontece a transcrição do vídeo e retorna essa transcrição via JSON
        const paramsSchema = z.object({
            videoId: z.string().uuid(),
        })
        const { videoId } = paramsSchema.parse(request.params); //parse vai validar se request.params tá seguindo os valores definidos no zod em object; se tiver seguindo, ele retorna um objeto e podemos então fazer a desestruturação com {videoId}

        const bodySchema = z.object({
            prompt: z.string(),
        })

        const { prompt } = bodySchema.parse(request.body);

        const video = await prisma.video.findUniqueOrThrow({ //FindUniqueOrThrow pois eu preciso do vídeo, é obrigatório, se não encontrar tem que disparar um erro
            where: {
                id: videoId,
            }
        })

        const videoPath = video.path //variavel salva no banco de dados no momento da inserção do video lá
        const audioReadStream = createReadStream(videoPath) //leitura de arquivo com modulo interno do node
        try {
            const response = await openai.audio.transcriptions.create({
                file: audioReadStream,
                model: "whisper-1",
                language: "pt",
                response_format: "json",
                temperature: 0,
                prompt,
            })

            const transcription = response.text

            await prisma.video.update({
                where: {
                    id: videoId,
                },
                data: {
                    transcription,
                },
            })

            return { transcription };

        } catch (error) {
            console.log("Caiu neste erro: " + error);
            reply.code(500).send("deu erro");

        }

    })

    app.post("/ai/complete", async (request, reply) => {

        const bodySchema = z.object({
            videoId: z.string().uuid(),
            prompt: z.string(),
            temperature: z.number().min(0).max(1).default(0.5),
        })

        const { videoId, prompt, temperature } = bodySchema.parse(request.body);

        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId,
            }
        })
 
        if (!video.transcription) {
            return reply.status(400).send({ error: "Video transcription was not generated yet" })
        }

        const promptMessage = prompt.replace("transcription", video.transcription)

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-16k",
            temperature,
            messages: [
                { role: "user", content: promptMessage }
            ],
            stream: true, //aqui, aparentemente, aciona o sistema de stream da openai.
        })

        const stream = OpenAIStream(response);
        streamToResponse(stream, reply.raw, {
            headers: { //nessa rota, precisamos fazer a configuração do cors, que fizemos no servidor, de maneira manual, pois nenhuma configuração que fazemos no fastify funcionará quando estivermos escrevendo uma resposta nativa do node.
                "Access-Control-Allow-Origin":"*",
                "Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS",

            }
        }) //raw retorna a referencia da resposta nativa do node, pois o fastify, apesar de usar o servidor http nativo do node por baixo dos panos, ele não usa diretamente as funções do node, ele cria como se fosse um wrapper em cima (cors são headers, apenas).

    })
}