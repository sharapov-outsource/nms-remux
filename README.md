```bash
ffmpeg \
    -re -i LaylatulQadirTurkishOnly.mp3 \
    -ar 44100 \
    -ac 2 \
    -c:a aac \
    -b:a 128k \
    -f flv rtmp://127.0.0.1:1935/live/translator
```

```bash
ffmpeg \
    -re -i LaylatulQadirOriginal.mp4 \
    -c:v copy \
    -c:a copy \
    -f flv rtmp://127.0.0.1:1935/live/original
```