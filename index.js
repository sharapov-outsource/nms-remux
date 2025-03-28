const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');

const config = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
    },
    http: {
        port: 8000,
        allow_origin: '*',
    },
};

const nms = new NodeMediaServer(config);

const targetRTMP = 'rtmp://127.0.0.1:1935/live/test';
const sourceVideoAudio = 'rtmp://127.0.0.1:1935/live/original';
const sourceTranslatorAudio = 'rtmp://127.0.0.1:1935/live/translator';

let ffmpegProcess = null;
let isTranslatorActive = false;
nms.on('postPublish', (id, streamPath, args) => {
    console.log(`[postPublish] Event triggered.`);

    // Inspect the `id` object to debug if needed
    console.log('Inspecting the raw `id` object:', require('util').inspect(id, { depth: 2 }));

    // Extract `streamPath` from the `id` object
    streamPath = streamPath || id.streamPath || '<undefined>';
    console.log(`Extracted Stream Path: ${streamPath}`);

    if (streamPath === '<undefined>') {
        console.error('[postPublish] Unable to determine streamPath. Skipping processing.');
        return;
    }

    console.log(`Stream started! Stream Path: ${streamPath}`);

    // Implement stream-specific logic here
    if (streamPath === '/live/original') {
        console.log('[Original Stream] Original feed detected.');
        // Custom logic for the original feed
    } else if (streamPath === '/live/translator') {
        console.log('[Translator Stream] Translator feed detected.');

        // Kill any active FFmpeg process before starting a new one
        if (ffmpegProcess) {
            console.log('[FFmpeg] Terminating active FFmpeg process...');
            ffmpegProcess.kill();
        }

        // Start FFmpeg to mix audio
        ffmpegProcess = spawnFFmpegWithTranslator();
    }
});

let ffmpegState = null; // Tracks the current state of FFmpeg ('original', 'translator', or null)

// Handles stream stoppage events
nms.on('donePublish', (id, streamPath, args) => {
    console.log(`[donePublish] Event triggered.`);

    // Extract `streamPath` from the `id` object
    streamPath = streamPath || id.streamPath || '<undefined>';
    console.log(`Extracted Stream Path: ${streamPath}`);

    if (streamPath === '<undefined>') {
        console.error('[donePublish] Unable to determine streamPath. Skipping processing.');
        return;
    }

    console.log(`Stream stopped! Stream Path: ${streamPath}`);

    if (streamPath === '/live/original') {
        console.log('[Original Stream] Original feed stopped.');

        // Stop both original and translator if original feed stops
        isTranslatorActive = false;

        if (ffmpegProcess) {
            console.log('[FFmpeg] Stopping active FFmpeg process...');
            ffmpegProcess.kill();
            ffmpegProcess = null;
            ffmpegState = null; // Clear FFmpeg state
            console.log('[FFmpeg] All streams stopped due to original feed stoppage.');
        }
    } else if (streamPath === '/live/translator') {
        console.log('[Translator Stream] Translator feed stopped.');

        isTranslatorActive = false;

        if (ffmpegState === 'translator' && ffmpegProcess) {
            console.log('[FFmpeg] Stopping translator FFmpeg process...');
            ffmpegProcess.kill();

            // Start FFmpeg for original stream only after the previous one stops
            ffmpegProcess.on('close', () => {
                console.log('[FFmpeg] Translator feed process stopped. Restarting for original...');
                ffmpegProcess = spawnFFmpegWithoutTranslator(); // Restart FFmpeg without translator
                ffmpegState = 'original'; // Update FFmpeg state
            });
        } else {
            console.log('[FFmpeg] No translator process to stop, or already running original stream.');
        }
    }
});


function spawnFFmpegWithTranslator() {
    const args = [
        '-re',
        '-i', sourceVideoAudio,
        '-i', sourceTranslatorAudio,
        '-filter_complex',
        `[0:a]volume=0.5[a1];[1:a]volume=1[a2];[a1][a2]amix=inputs=2:duration=first[aout]`,
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-f', 'flv',
        targetRTMP,
    ];

    console.log('[FFmpeg] Command: ffmpeg ' + args.join(' '));
    const process = spawn('ffmpeg', args);

    process.stdout.on('data', (data) => {
        console.error(`[FFmpeg STDOUT] ${data}`);
    });
    process.on('close', (code) => {
        console.log(`[FFmpeg] Process exited with code ${code}`);
    });

    return process;
}

function spawnFFmpegWithoutTranslator() {
    const args = [
        '-re',
        '-i', sourceVideoAudio,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'flv',
        targetRTMP,
    ];

    console.log('[FFmpeg] Command: ffmpeg ' + args.join(' '));
    const process = spawn('ffmpeg', args);

    process.stdout.on('data', (data) => {
        console.error(`[FFmpeg STDOUT] ${data}`);
    });
    process.on('close', (code) => {
        console.log(`[FFmpeg] Process exited with code ${code}`);
    });

    return process;
}

nms.run();
console.log('NodeMediaServer is running on port 1935.');