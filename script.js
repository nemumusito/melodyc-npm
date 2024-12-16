// グローバル変数の定義
let audioContext = null;
let currentInstrument = null;
let currentInput = null;
let analyser = null;
let dataArray = null;
const activeNotes = new Set();

// オーディオビジュアライザーの設定
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

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
    
    // WebMIDI APIを直接使用してMIDIデバイスをチェック
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess()
            .then(access => {
                console.log('MIDI Access granted:', access);
                const inputs = Array.from(access.inputs.values());
                console.log('Direct MIDI inputs:', inputs);
                
                if (inputs.length === 0) {
                    select.innerHTML += '<option value="" disabled>MIDIデバイスが見つかりません</option>';
                    console.log('No MIDI devices found via direct access');
                    return;
                }

                inputs.forEach(input => {
                    const option = document.createElement('option');
                    option.value = input.id;
                    option.textContent = input.name;
                    select.appendChild(option);
                    console.log('Found MIDI device (direct):', input.name, input.id);
                });
            })
            .catch(error => {
                console.error('Direct MIDI access error:', error);
                select.innerHTML += '<option value="" disabled>MIDIアクセスエラー</option>';
            });
    }
    
    // WebMidi.jsのデバイス一覧も確認
    if (WebMidi && WebMidi.inputs) {
        console.log('WebMidi.js inputs:', WebMidi.inputs);
        if (WebMidi.inputs.length === 0) {
            console.log('No MIDI devices found via WebMidi.js');
        }
        
        WebMidi.inputs.forEach(input => {
            console.log('Found MIDI device (WebMidi.js):', input.name, input.id);
        });
    }
}

// オーディオコンテキストの初期化
async function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('AudioContext resumed successfully');
        } catch (error) {
            console.error('Failed to resume AudioContext:', error);
            throw error;
        }
    }

    if (!analyser) {
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.connect(audioContext.destination);
    }

    return audioContext;
}

// 音源の初期化
async function initializeInstrument() {
    try {
        console.log('Initializing piano...');
        
        // オーディオコンテキストの初期化を確認
        await initializeAudioContext();

        // グランドピアノの音源をロード
        currentInstrument = await Soundfont.instrument(audioContext, 'acoustic_grand_piano', {
            soundfont: 'MusyngKite',
            format: 'mp3',
            gain: 2.0
        });

        // アナライザーに接続
        currentInstrument.connect(analyser);
        
        console.log('Piano initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize piano:', error);
        return false;
    }
}

// 音を再生する共通関数
async function playNote(note, velocity = 0.7) {
    if (!currentInstrument || !note) return;
    
    try {
        console.log(`Playing note: ${note} with velocity: ${velocity}`);
        await currentInstrument.play(note, 0, { gain: velocity });
    } catch (error) {
        console.error(`Error playing note ${note}:`, error);
    }
}

// 音を停止する共通関数
function stopNote(note) {
    if (!currentInstrument || !note) return;
    
    try {
        console.log(`Stopping note: ${note}`);
        currentInstrument.stop();
    } catch (error) {
        console.error(`Error stopping note ${note}:`, error);
    }
}

// キーの色を変更する関数
function setKeyColor(keyElement, isPressed) {
    if (!keyElement) return;
    
    const isBlack = keyElement.classList.contains('black');
    keyElement.style.backgroundColor = isPressed ? '#7cb5ec' : (isBlack ? '#000' : '#fff');
}

// キーボードイベントのセットアップ
function setupKeyboardEvents() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        const note = key.dataset.note;

        // マウスイベント
        key.addEventListener('mousedown', (event) => {
            if (!activeNotes.has(note)) {
                playNote(note);
                setKeyColor(event.target, true);
                activeNotes.add(note);
            }
        });

        const handleNoteOff = (event) => {
            if (activeNotes.has(note)) {
                stopNote(note);
                setKeyColor(event.target, false);
                activeNotes.delete(note);
            }
        };

        key.addEventListener('mouseup', handleNoteOff);
        key.addEventListener('mouseleave', handleNoteOff);

        // タッチイベント
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!activeNotes.has(note)) {
                playNote(note);
                setKeyColor(e.target, true);
                activeNotes.add(note);
            }
        });

        key.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleNoteOff(e);
        });
    });

    // ページがフォーカスを失った時に全ての音を停止
    window.addEventListener('blur', () => {
        activeNotes.forEach(note => {
            stopNote(note);
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            setKeyColor(keyElement, false);
        });
        activeNotes.clear();
    });
}

// MIDIイベントのセットアップ
function setupMIDIEvents(input) {
    if (!input) return;
    
    console.log("Setting up MIDI listeners for:", input.name);

    // WebMidi.jsのイベントリスナー
    if (input.addListener) {
        input.addListener("noteon", "all", (e) => {
            const note = e.note.identifier;
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            
            if (!activeNotes.has(note)) {
                playNote(note, e.note.velocity);
                setKeyColor(keyElement, true);
                activeNotes.add(note);
            }
        });

        input.addListener("noteoff", "all", (e) => {
            const note = e.note.identifier;
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            
            if (activeNotes.has(note)) {
                stopNote(note);
                setKeyColor(keyElement, false);
                activeNotes.delete(note);
            }
        });
    } 
    // 直接のWeb MIDI APIイベントリスナー
    else {
        input.onmidimessage = (event) => {
            const [command, note, velocity] = event.data;
            const keyElement = document.querySelector(`[data-note="${note}"]`);

            // Note On
            if ((command & 0xf0) === 0x90 && velocity > 0) {
                if (!activeNotes.has(note)) {
                    playNote(note, velocity / 127);
                    setKeyColor(keyElement, true);
                    activeNotes.add(note);
                }
            }
            // Note Off
            else if ((command & 0xf0) === 0x80 || ((command & 0xf0) === 0x90 && velocity === 0)) {
                if (activeNotes.has(note)) {
                    stopNote(note);
                    setKeyColor(keyElement, false);
                    activeNotes.delete(note);
                }
            }
        };
    }
}

// MIDIデバイス選択の処理
function setupMIDIDeviceSelection() {
    const midiSelect = document.getElementById('midiInput');
    
    midiSelect.addEventListener('change', async (e) => {
        try {
            if (currentInput) {
                if (currentInput.removeListener) {
                    currentInput.removeListener();
                } else if (currentInput.onmidimessage) {
                    currentInput.onmidimessage = null;
                }
            }

            const selectedId = e.target.value;
            if (!selectedId) {
                console.log("No MIDI device selected");
                return;
            }

            // まずWebMidi.jsで試行
            currentInput = WebMidi.getInputById(selectedId);
            
            // WebMidi.jsで見つからない場合、直接のMIDIアクセスを試行
            if (!currentInput) {
                const midiAccess = await navigator.requestMIDIAccess();
                currentInput = Array.from(midiAccess.inputs.values())
                    .find(input => input.id === selectedId);
            }

            if (!currentInput) {
                throw new Error(`MIDI device with ID ${selectedId} not found`);
            }

            setupMIDIEvents(currentInput);
            console.log("MIDI device setup completed for:", currentInput.name);

        } catch (error) {
            console.error("Error setting up MIDI device:", error);
            alert('MIDIデバイスの設定に失敗しました。\n' + error.message);
            midiSelect.value = '';
            currentInput = null;
        }
    });

    // 初期MIDIデバイスリストの更新
    updateMIDIInputs();
}

// セキュリティコンテキストの確認
function checkSecurityContext() {
    console.log('Security Context Check:');
    console.log('- isSecureContext:', window.isSecureContext);
    console.log('- protocol:', window.location.protocol);
    console.log('- host:', window.location.host);
    
    if (!window.isSecureContext) {
        console.error('Not running in a secure context');
        return false;
    }
    return true;
}

// アプリケーションの初期化
async function initializeApp() {
    try {
        console.log('Initializing application...');
        console.log('User Agent:', navigator.userAgent);
        
        // セキュリティコンテキストの確認
        if (!checkSecurityContext()) {
            throw new Error('このアプリケーションはHTTPS環境で実行する必要があります。');
        }

        // WebMIDIのサポート確認
        if (!navigator.requestMIDIAccess) {
            throw new Error('このブラウザはWeb MIDI APIをサポートしていません。');
        }

        // 直接のMIDIアクセスを試行
        try {
            const midiAccess = await navigator.requestMIDIAccess();
            console.log('Direct MIDI access successful:', midiAccess);
            
            midiAccess.onstatechange = (e) => {
                console.log('MIDI State Change:', e.port.name, e.port.state);
                updateMIDIInputs();
            };
        } catch (midiError) {
            console.error('Direct MIDI access failed:', midiError);
        }

        // WebMidi.jsの初期化
        await WebMidi.enable({ sysex: true }).catch(error => {
            console.error('WebMidi.js initialization error:', error);
        });
        
        console.log('WebMidi enabled:', WebMidi.enabled);
        
        // オーディオコンテキストの初期化
        await initializeAudioContext();
        
        // グランドピアノの初期化
        const success = await initializeInstrument();
        if (!success) {
            throw new Error('Failed to initialize piano');
        }
        
        // 各種セットアップ
        setupKeyboardEvents();
        setupMIDIDeviceSelection();
        drawVisualizer();
        
        // ユーザーインタラクションを待つ
        document.addEventListener('click', async () => {
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
        }, { once: true });
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        const errorMessage = `アプリケーションの初期化に失敗しました。
1. ブラウザがWeb MIDI APIをサポートしているか確認してください。
2. MIDIデバイスが正しく接続されているか確認してください。
3. ブラウザのMIDIアクセス許可が与えられているか確認してください。
4. HTTPSで接続されているか確認してください。

エラー詳細: ${error.message}`;
        
        alert(errorMessage);
    }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(console.error);
});
