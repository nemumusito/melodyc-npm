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

// MIDIデバイスのセットアップ
WebMidi.enable()
    .then(async () => {
        // 初期のMIDIデバイス一覧を表示
        updateMIDIInputs();

        // Tone.jsの設定
        await Tone.start();
        const synth = new Tone.PolySynth(Tone.Synth, {
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).toDestination();

        // アナライザーの設定
        analyser = Tone.getContext().createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        synth.connect(analyser);

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
                    synth.triggerAttack(note, Tone.now(), velocity);
                    updateKeyVisual(note, true);
                });

                // Note OFFイベントのリスナー
                currentInput.addListener("noteoff", (e) => {
                    const note = e.note.identifier;
                    synth.triggerRelease(note);
                    updateKeyVisual(note, false);
                });
            }
        });
    })
    .catch(err => {
        console.error("WebMidi could not be enabled.", err);
        document.body.innerHTML += '<p class="error">MIDIデバイスの接続に失敗しました。</p>';
    });