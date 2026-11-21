// Sample card text for the component stories (issue #55): long Telugu and CJK strings that check wrapping,
// line height and the bundled fonts. This is learning content, like a deck, not interface text, so it is
// not in locales/en.json.

/** "This sentence is very long and shows how the text wraps inside the component." */
export const TELUGU_LONG = 'ఈ వాక్యం చాలా పొడవైనది మరియు భాగం లోపల వచనం ఎలా విరుగుతుందో చూపిస్తుంది';
export const TELUGU_SHORT = 'తెలుగు పాఠం';

/** The same sentence in Japanese and Chinese: CJK wraps between any two characters. */
export const CJK_LONG =
  'この文はとても長くて、部品の中で文字がどのように折り返されるかを確認するためのものです。这是一个很长的句子。';
export const CJK_SHORT = '日本語の練習';

/** An explain card's key points (#199), learning content like the strings above. */
export const KEY_POINTS = ['Earth is tilted', 'The tilt changes the angle of sunlight', 'Not the distance to the sun'];
