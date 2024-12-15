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
    const ctx = Tone.context;
    await ctx.resume();
    
    const originalLatency = ctx.baseLatency || 0;
    const lookahead = 0.01;
    
    Tone.context.lookAhead = lookahead;
    Tone.context.updateInterval = 0.01;
    
    console.log(`Audio latency: ${originalLatency * 1000}ms`);
    console.log('Audio context optimized');
}

// MIDIデバイスのセットアップ
WebMidi.enable()
    .then(async () => {
        await optimizeAudioContext();
        updateMIDIInputs();
        await Tone.start();

        // 音源の初期化
        const piano = new Tone.Sampler({
            urls: {
                C2: "C2.mp3",
                E2: "E2.mp3",
                G2: "G2.mp3",
                C3: "C3.mp3",
                E3: "E3.mp3",
                G3: "G3.mp3",
                C4: "C4.mp3",
                E4: "E4.mp3",
                G4: "G4.mp3",
                C5: "C5.mp3",
                E5: "E5.mp3",
                G5: "G5.mp3",
                C6: "C6.mp3",
            },
            release: 1,
            baseUrl: "https://tonejs.github.io/audio/salamander/",
            onload: () => console.log("Piano loaded")
        }).toDestination();

        const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "sawtooth"
            },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0.3,
                release: 2
            }
        }).toDestination();

        const electric = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3,
            modulationIndex: 10,
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.2,
                release: 1
            },
            modulation: {
                type: "square"
            },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0,
                sustain: 1,
                release: 0.5
            }
        }).toDestination();

        const instruments = {
            piano: piano,
            synth: synth,
            electric: electric
        };

        let currentInstrument = piano;

        // アナライザーの設定
        analyser = Tone.getContext().createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        Object.values(instruments).forEach(inst => inst.connect(analyser));

        // ビジュアライザーの開始
        drawVisualizer();

        let currentInput = null;
        const activeNotes = new Set();

        // 音源選択の処理
        document.getElementById('soundType').addEventListener('change', (e) => {
            const selectedInstrument = instruments[e.target.value];
            if (selectedInstrument) {
                // アクティブな音を全て停止
                activeNotes.forEach(note => {
                    currentInstrument.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                });
                activeNotes.clear();
                
                currentInstrument = selectedInstrument;
            }
        });

        // マウスでの演奏機能
        const keys = document.querySelectorAll('.key');
        keys.forEach(key => {
            const note = key.dataset.note;
            
            key.addEventListener('mousedown', () => {
                if (!activeNotes.has(note)) {
                    currentInstrument.triggerAttack(note, '+0');
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                }
            });

            key.addEventListener('mouseup', () => {
                if (activeNotes.has(note)) {
                    currentInstrument.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                }
            });

            key.addEventListener('mouseleave', () => {
                if (activeNotes.has(note)) {
                    currentInstrument.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                }
            });

            // タッチデバイス対応
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!activeNotes.has(note)) {
                    currentInstrument.triggerAttack(note, '+0');
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                }
            });

            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (activeNotes.has(note)) {
                    currentInstrument.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                }
            });
        });

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
                    currentInstrument.triggerAttack(note, '+0', velocity);
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                });

                // Note OFFイベントのリスナー
                currentInput.addListener("noteoff", (e) => {
                    const note = e.note.identifier;
                    currentInstrument.triggerRelease(note, '+0');
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                });
            }
        });
    })
    .catch(err => {
        console.error("WebMidi could not be enabled.", err);
        document.body.innerHTML += '<p class="error">MIDIデバイスの接続に失敗しました。</p>';
    });