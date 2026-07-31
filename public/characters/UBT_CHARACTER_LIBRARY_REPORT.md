# Relatório de Criação da Biblioteca Oficial de Personagens da UBT v2.0 (Extraído)

Este relatório documenta a estruturação e implantação da biblioteca oficial de referência visual **comprovadamente extraída** para os personagens recorrentes da UBT Story Experience, utilizando como única fonte o vídeo aprovado **Cena02v02g.mp4 ("Mototaxi pick-up in Ubatuba")** e o logotipo institucional, atendendo a 100% das restrições anti-IA generativa do projeto.

---

## 1. Conformidade com as Regras de Produção

1.  **Zero IA Generativa:** Nenhum algoritmo gerador (como Midjourney, Stable Diffusion ou DALL-E) foi utilizado. Todas as imagens são recortes brutos de quadros reais da filmagem.
2.  **Zero Redesenho/Reinterpretação:** Os rostos, corpos, veículos e roupas são reproduções fiéis e exatas dos pixels gravados na produção do vídeo aprovado.
3.  **Zero Melhoramento/Filtros por IA:** Os frames foram mantidos em sua resolução original e gama de cores nativa, sem upscaling artificial.
4.  **Logotipo Institucional Intacto:** A referência do logo foi copiada diretamente do arquivo oficial [`logo-02.png`](file:///C:/Users/MacInBox/Documents/profissional/ubt/imagem/logo-02.png), sem sofrer vetorização, extração do vídeo ou modificação geométrica.

---

## 2. Metodologia de Extração de Frames e Recorte (Crop)

*   **Extração de Keyframes:** Foi realizada a decodificação da trilha de vídeo de `Cena02v02g.mp4` a 1 FPS com o extrator estático de mídia `ffmpeg-static`, gerando 12 quadros PNG originais em `comunicacao/06_Scenes/Cena02/Frames/`.
*   **Recorte Preciso (Jimp Engine):** Foi utilizado o processador de imagem `jimp@0.22.12` em Node para recortar as coordenadas exatas correspondentes aos elementos da governança:
    *   **A01_Mototaxista (Nós das Cenas 05 e 06):**
        *   `Face.png` / `Face.jpg`: Recorte da região da cabeça e expressão facial (Cena 05 - head close-up).
        *   `Corpo.png` / `Corpo.jpg`: Recorte do enquadramento vertical de corpo e postura ao lado da motocicleta (Cena 06).
        *   `Moto.png` / `Moto.jpg`: Recorte horizontal em close-up do modelo de moto oficial.
        *   `Capacete.png` / `Capacete.jpg`: Zoom do capacete preto fosco com adesivo UBT.
        *   `Jaqueta.png` / `Jaqueta.jpg`: Amostra da jaqueta azul impermeável.
    *   **A02_Diarista (Nós da Cena 08):**
        *   `Face.png` / `Face.jpg`: Retrato facial da atriz com iluminação natural.
        *   `Corpo.png` / `Corpo.jpg`: Enquadramento vertical de vestimentas (camiseta clara, jeans e tênis).
        *   `Ecobag.png` / `Ecobag.jpg`: Recorte aproximado da bolsa de lona UBT-P01.
        *   `Mochila.png` / `Mochila.jpg`: Zoom da mochila cinza utilitária.
        *   `Sapatos.png` / `Sapatos.jpg`: Zoom da área dos tênis confortáveis de caminhada.

---

## 3. Estrutura Física Concluída (Dupla Extensão PNG/JPG)

Para garantir compatibilidade absoluta de leitura no leitor do markdown e em compiladores de mídia, cada frame recortado foi salvo em **duplo formato** (mantendo os pixels nativos de PNG sem compressão destrutiva):

```
/comunicacao/01_Characters
   ├── A01_Mototaxista/
   │     ├── Face.png / Face.jpg
   │     ├── Corpo.png / Corpo.jpg
   │     ├── Moto.png / Moto.jpg
   │     ├── Capacete.png / Capacete.jpg
   │     ├── Jaqueta.png / Jaqueta.jpg
   │     └── Logo.png / Logo.jpg   <-- Cópia exata de logo-02.png
   └── A02_Diarista/
         ├── Face.png / Face.jpg
         ├── Corpo.png / Corpo.jpg
         ├── Ecobag.png / Ecobag.jpg
         ├── Mochila.png / Mochila.jpg
         └── Sapatos.png / Sapatos.jpg
```

---

## 4. Atualização das Referências de Governança
O arquivo de governança oficial [`UBT_CHARACTER_REFERENCE_v1.0.md`](file:///C:/Users/MacInBox/Documents/profissional/ubt/comunicacao/00_Governanca/UBT_CHARACTER_REFERENCE_v1.0.md) mapeia com precisão os caminhos locais de referência para o novo banco de frames recortados.
