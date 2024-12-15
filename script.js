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
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    return ctx;
}

// 音源の初期化
async function initializeInstrument(audioContext, instrumentName) {
    try {
        return await Soundfont.instrument(audioContext, instrumentName, {
            soundfont: 'MusyngKite',
            gain: 2.0
        });
    } catch (error) {
        console.error(`Failed to load instrument: ${instrumentName}`, error);
        throw error;
    }
}

// MIDIデバイスのセットアップ
WebMidi.enable()
    .then(async () => {
        console.log("WebMidi enabled!");
        updateMIDIInputs();
        
        const audioContext = await optimizeAudioContext();
        let currentInstrument = await initializeInstrument(audioContext, 'acoustic_grand_piano');
        
        // アナライザーの設定
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // ビジュアライザーの開始
        drawVisualizer();

        let currentInput = null;
        const activeNotes = new Set();

        // 音源選択の処理
        document.getElementById('soundType').addEventListener('change', async (e) => {
            const selectedInstrument = e.target.value;
            try {
                // ローディング表示
                e.target.disabled = true;
                e.target.style.opacity = '0.5';
                
                // アクティブな音を全て停止
                activeNotes.forEach(note => {
                    currentInstrument.stop();
                    updateKeyVisual(note, false);
                });
                activeNotes.clear();
                
                // 新しい音源を読み込む
                currentInstrument = await initializeInstrument(audioContext, selectedInstrument);
                currentInstrument.connect(analyser);
                
                // ローディング表示を解除
                e.target.disabled = false;
                e.target.style.opacity = '1';
            } catch (error) {
                console.error('Failed to change instrument:', error);
                e.target.disabled = false;
                e.target.style.opacity = '1';
            }
        });

        // マウスでの演奏機能
        const keys = document.querySelectorAll('.key');
        keys.forEach(key => {
            const note = key.dataset.note;
            
            key.addEventListener('mousedown', () => {
                if (!activeNotes.has(note)) {
                    currentInstrument.play(note);
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                }
            });

            key.addEventListener('mouseup', () => {
                if (activeNotes.has(note)) {
                    currentInstrument.stop(note);
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                }
            });

            key.addEventListener('mouseleave', () => {
                if (activeNotes.has(note)) {
                    currentInstrument.stop(note);
                    updateKeyVisual(note, false);
                    activeNotes.delete(note);
                }
            });

            // タッチデバイス対応
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!activeNotes.has(note)) {
                    currentInstrument.play(note);
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                }
            });

            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (activeNotes.has(note)) {
                    currentInstrument.stop(note);
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
                    currentInstrument.play(note, 0, { gain: e.note.velocity });
                    updateKeyVisual(note, true);
                    activeNotes.add(note);
                });

                // Note OFFイベントのリスナー
                currentInput.addListener("noteoff", (e) => {
                    const note = e.note.identifier;
                    currentInstrument.stop(note);
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