import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util"
import { api } from "../lib/axios"

export function VideoInputForm() {

    const [videoFile, setVideoFile] = useState<File | null>(null)
    const promptInputRef = useRef<HTMLTextAreaElement>(null) //serve para acessar o elemento na DOM (pequeno delay, mas bem pouco, por isso a interrogação ao acessar propriedades do elemento via ref)

    function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget

        if (!files) { //sempre será um array, mas como em nosso input não tem a palavra reservada multiple, só teremos um arquivo, logo é files[0]
            return
        }

        setVideoFile(files[0]);

    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault() //evitar recarrego de paágina ao chamar função (acontece naturalmente na requisição do form)

        const prompt = promptInputRef.current?.value;

        if (!videoFile) {
            return
        }

        //converter video em audio (pois api suporte apenas 25mb, logo para video é muito pouco)
        const audioFile = await convertVideoToAudio(videoFile);

        const data = new FormData() //precisa ser form data, pois pra mandar arquivos para backend (api), precisamos utilizar o formdata, não é um JSON como normalmente.
        data.append("file", audioFile)

        const response = await api.post("/videos", data);
        const videoId = response.data.video.id; //pegando id do video trabalhado e armazenado no BD

        await api.post(`/videos/${videoId}/transcription`, {
            prompt,
        });

        console.log("All done");



    }

    async function convertVideoToAudio(video: File) {
        console.log("convert starts")

        const ffmpeg = await getFFmpeg();
        await ffmpeg.writeFile("input.mp4", await fetchFile(video));
        //ffmpeg.on("log", log => {
        //  console.log(log);
        //})
        ffmpeg.on("progress", progress => {
            console.log("Convert progresss: " + Math.round(progress.progress * 100)); //vem entre 0 e 1, por isso a multiplicação por 100
        });
        await ffmpeg.exec([
            "-i",
            "input.mp4",
            "-map",
            "0:a",
            "-b:a",
            "20k",
            "-acodec",
            "libmp3lame",
            "output.mp3"
        ])

        const data = await ffmpeg.readFile("output.mp3"); //aqui faz a leitura deste suposto container criado no lado do navegador com webASsembly
        const audioFileBlob = new Blob([data], { type: "audio/mpeg" }); //blob é utilizado para representar um dado de maneira mais nativa (muito utilizado no node, em streams)
        const audioFile = new File([audioFileBlob], "audio.mp3", { //aqui é de fato a conversão do Blob em um mp3
            type: "audio/mpeg",
        });

        console.log("Convert finished");

        return audioFile;
    }


    const previewURL = useMemo(() => {
        if (!videoFile) {
            return null
        }

        return URL.createObjectURL(videoFile) //cria objeto para preview no box
    }, [videoFile]) //se videoFile mudar a gente vai montar outro objeto deste video novamente, pois não é bom ficar a todo momento fazendo isso, apenas por mudança de algum estado qualquer que faz com que a pagina seja renderizada novamente. custo alto.

    return (
        <form onSubmit={handleUploadVideo} className="space-y-6">
            <label
                htmlFor="video"
                className="relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"

            >
                {previewURL ? (
                    <video src={previewURL} controls={false} className="pointer-events-none absolut inset-0" />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Selecione um vídeo
                    </>
                )}
            </label>
            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelect} />
            <Separator />
            <div className="space-y-2">
                <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
                <Textarea
                    ref={promptInputRef}
                    id="trancription_prompt"
                    className="h-20 leading-relaxed resize-none"
                    placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgulas (,)" />
            </div>
            <Button type="submit" className="w-full">
                Carregar vídeo
                <Upload className="h-4 w-4 ml-2" />
            </Button>
        </form>
    )
}


