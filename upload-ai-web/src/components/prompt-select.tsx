import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { api } from "@/lib/axios";

export function PromptSelect() {

    const [prompts, setPrompts] = useState(null);
    useEffect(() => {
        api.get("/prompts").then(response => {
            setPrompts(response.data);
        })
    }, [])

    return (
        <Select>
            <SelectTrigger>
                <SelectValue placeholder="Selecione um prompt..."></SelectValue>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="title">Titulo do YouTube</SelectItem>
                <SelectItem value="description">Descrição do YouTube</SelectItem>
            </SelectContent>
        </Select>
    )
}