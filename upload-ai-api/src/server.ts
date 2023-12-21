import { fastify } from "fastify"
import { fastifyCors } from "@fastify/cors"
import { promptsRoute } from "./routes/prompts"
import { videosRoute } from "./routes/videos";

const app = fastify({
    logger: true
})

try {

    app.register(fastifyCors, {
        origin: "*",
    })

    //Cadastrando rotas (Nas rotas, dentro de routes, as dunções exportadas precisam receber como parâmetro nosso app ali em cima, pra conseguirmos utiliuzar as funções de rota do fastify lá e depois apenas registra-las aqui)
    //Todas as funções registradas precisam ser assincronas (exigência do fastify)
    app.register(promptsRoute);
    app.register(videosRoute);

    app.listen({
        port: 3333,
    })
}
catch (error) {
    console.log(error);
}