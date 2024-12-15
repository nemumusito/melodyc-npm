import * as WebMidi from "webmidi";
import * as Tone from "tone";

WebMidi.enable()
  .then(() => {
    if (WebMidi.inputs.length > 0) {
      const input = WebMidi.inputs[0];
      const synth = new Tone.Synth().toDestination();

      input.addListener("noteon", (e) => {
        const note = WebMidi.MIDIUtils.noteNumberToName(e.note.number);
        synth.triggerAttack(note);
      });

      input.addListener("noteoff", (e) => {
        const note = WebMidi.MIDIUtils.noteNumberToName(e.note.number);
        synth.triggerRelease(note);
      });
    } else {
      console.log("No MIDI input devices detected.");
    }
  })
  .catch((err) => {
    console.log("WebMidi could not be enabled.", err);
  });