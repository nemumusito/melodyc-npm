// オーディオビジュアライザーの設定
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let analyser;
let dataArray;

// キャンバスのサイズをウィンドウに合わせる
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ビジュアライザーの描画
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    if (!analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] * 1.5;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#7cb5ec');
        gradient.addColorStop(1, '#4a90e2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
    }
}

// MIDIデバイスの選択肢を更新する関数
function updateMIDIInputs() {
    const select = document.getElementById('midiInput');
    select.innerHTML = '<option value="">MIDIデバイスを選択してください</option>';
    
    WebMidi.inputs.forEach(input => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name;
        select.appendChild(option);
    });
}

// キーの見た目を更新する関数
function updateKeyVisual(note, isPressed) {
    const keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) {
        if (isPressed) {
            keyElement.classList.add('active');
        } else {
            keyElement.classList.remove('active');
        }
    }
}

// オーディオコンテキストの最適化設定
async function optimizeAudioContext() {
    // バッファサイズを小さくして遅延を減らす
    const ctx = Tone.context;
    await ctx.resume();
    
    // Web Audio APIの設定を最適化
    const originalLatency = ctx.baseLatency || 0;
    const lookahead = 0.01; // 10ms
    
    // Tone.jsの内部設定を最適化
    Tone.context.lookAhead = lookahead;
    Tone.context.updateInterval = 0.01; // 10ms
    
    console.log(`Audio latency: ${originalLatency * 1000}ms`);
    console.log('Audio context optimized');
}

// MIDIデバイスのセットアップ
WebMidi.enable()
    .then(async () => {
        // オーディオコンテキストの最適化
        await optimizeAudioContext();
        
        // 初期のMIDIデバイス一覧を表示
        updateMIDIInputs();

        // Tone.jsの設定
        await Tone.start();
        
        // Salamander Grand Piano音源の設定
        const piano = new Tone.Sampler({
            urls: {
                A0: "A0.mp3",
                C1: "C1.mp3",
                "D#1": "Ds1.mp3",
                "F#1": "Fs1.mp3",
                A1: "A1.mp3",
                C2: "C2.mp3",
                "D#2": "Ds2.mp3",
                "F#2": "Fs2.mp3",
                A2: "A2.mp3",
                C3: "C3.mp3",
                "D#3": "Ds3.mp3",
                "F#3": "Fs3.mp3",
                A3: "A3.mp3",
                C4: "C4.mp3",
                "D#4": "Ds4.mp3",
                "F#4": "Fs4.mp3",
                A4: "A4.mp3",
                C5: "C5.mp3",
                "D#5": "Ds5.mp3",
                "F#5": "Fs5.mp3",
                A5: "A5.mp3",
                C6: "C6.mp3",
                "D#6": "Ds6.mp3",
                "F#6": "Fs6.mp3",
                A6: "A6.mp3",
                C7: "C7.mp3",
                "D#7": "Ds7.mp3",
                "F#7": "Fs7.mp3",
                A7: "A7.mp3",
            },
            release: 1,
            baseUrl: "https://tonejs.github.io/audio/salamander/",
            onload: () => {
                console.log("Piano loaded successfully");
                // 音源がロードされたら通知を表示
                const notification = document.createElement('div');
                notification.textContent = '音源のロードが完了しました';
                notification.style.position = 'fixed';
                notification.style.top = '20px';
                notification.style.left = '50%';
                notification.style.transform = 'translateX(-50%)';
                notification.style.padding = '10px 20px';
                notification.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
                notification.style.borderRadius = '5px';
                notification.style.zIndex = '1000';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }
        }).toDestination();

        // アナライザーの設定
        analyser = Tone.getContext().createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        piano.connect(analyser);

        // ビジュアライザーの開始
        drawVisualizer();

        let currentInput = null;

        // MIDIデバイスの選択が変更されたときの処理
        document.getElementById('midiInput').addEventListener('change', (e) => {
            if (currentInput) {
                currentInput.removeListener();
            }

            const selectedId = e.target.value;
            if (selectedId) {
                currentInput = WebMidi.getInputById(selectedId);
                
                // Note ONイベントのリスナー
                currentInput.addListener("noteon", (e) => {
                    const note = e.note.identifier;
                    const velocity = e.note.velocity;
                    // 即時に音を鳴らす
                    piano.triggerAttack(note, '+0', velocity);
                    updateKeyVisual(note, true);
                });

                // Note OFFイベントのリスナー
                currentInput.addListener("noteoff", (e) => {
                    const note = e.note.identifier;
                    piano.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                });
            }
        });
    })
    .catch(err => {
        console.error("WebMidi could not be enabled.", err);
        document.body.innerHTML += '<p class="error">MIDIデバイスの接続に失敗しました。</p>';
    });