import { FastifyInstance } from "fastify";
import {fastifyMultipart} from "@fastify/multipart"
import { prisma } from "../lib/prisma";
import fs from  "node:fs"
import {pipeline} from "node:stream"
import path from "node:path"; //pra gente buscar o caminho do arquivo enviado; Assim sabemos quando vem do node, ou de algum pacote instalado via npm ou pnpm
import { randomUUID } from "node:crypto"; //pra gerarmos um id aleatório; outro módulo interno do node
import {promisify} from "node:util"
import {z} from "zod"

const pump = promisify(pipeline) //node tem um grande diferencial que é de trabalhar com streaming (formas de ler dados ou escrever dados aos poucos); ou seja, chegou um pedaço for arquivo, ao invés de alocar em memoria ram, já vamos escrevendo ele em disco
                                //daí vem o pipeline, processo de upload total, que utiliza de uma biblioteca antiga, por isso utilizados a função promisify para conseguirmos utilizar async e await e fazermos via promise.
export async function videosRoute(app: FastifyInstance){

    app.register(fastifyMultipart, {
        limits: {
            fileSize: 1_048_576 * 25 //25mb - Pois, conforme documentação, valor default pra esse multipart-limits-filesize é de 1048576 (não tem problema colocar underline nas unidades de milhares)
        }
    })

    app.post("/videos", async (request, reply) => {
        const data = await request.file()
        if(!data){
            return reply.status(400).send(
                {
                    error: "Missing file input"
                })
        }

        const extension = path.extname(data.filename) //importações de modulos que de algum modo são internas do node (path, fs, crypto, http, util, stream), a gente precisa 
        
        if(extension != ".mp3"){
            return reply.status(400).send({
                error: "Invalid input type.  Please upload a MP3"
            })
        }

        const fileBaseName = path.basename(data.filename, extension) //mudar os nomes, pois podem vir nomes iguais em arquivos de pessoas diferentes, por isso criamos o nome dele no fileBaseName e alteramos
        const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}`
        const uploadDestination = path.resolve(__dirname,"../../tmp", fileUploadName) //pegando diretorio desejado para despejo de file e colocando junto com nome do arquivo

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

    app.post("/videos/:videoId/transcription", async (request) => {
        const paramsSchema = z.object({
            videoId: z.string().uuid(),
        })
        const {videoId} = paramsSchema.parse(request.params); //parse vai validar se request.params tá seguindo os valores definidos no zod em object; se tiver seguindo, ele retorna um objeto e podemos então fazer a desestruturação com {videoId}

    })
}