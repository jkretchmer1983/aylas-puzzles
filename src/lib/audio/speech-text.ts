/** Turn visible puzzle text into accurate spoken words. Never adds or changes puzzle facts. */
const EMOJI: Record<string, [string, string]> = {
  '🍎': ['apple', 'apples'], '🍐': ['pear', 'pears'], '🍒': ['cherry', 'cherries'], '🍌': ['banana', 'bananas'], '🍇': ['bunch of grapes', 'bunches of grapes'],
  '🍉': ['watermelon', 'watermelons'], '🍊': ['orange', 'oranges'], '🍓': ['strawberry', 'strawberries'], '🫐': ['blueberry', 'blueberries'], '🥕': ['carrot', 'carrots'],
  '🍕': ['pizza', 'pizzas'], '🍦': ['ice cream', 'ice creams'], '🍩': ['donut', 'donuts'], '🍪': ['cookie', 'cookies'], '🍬': ['candy', 'candies'], '🍭': ['lollipop', 'lollipops'],
  '🧁': ['cupcake', 'cupcakes'], '🥧': ['pie', 'pies'], '🧃': ['juice box', 'juice boxes'], '🍄': ['mushroom', 'mushrooms'], '🎁': ['present', 'presents'], '🎈': ['balloon', 'balloons'],
  '⭐': ['star', 'stars'], '🌟': ['star', 'stars'], '🌸': ['flower', 'flowers'], '💎': ['gem', 'gems'], '🪙': ['coin', 'coins'], '🧱': ['block', 'blocks'], '🪨': ['stone', 'stones'],
  '⚽': ['soccer ball', 'soccer balls'], '⚾': ['baseball', 'baseballs'], '🏀': ['basketball', 'basketballs'], '🏈': ['football', 'footballs'], '🎾': ['tennis ball', 'tennis balls'], '🏐': ['volleyball', 'volleyballs'],
  '🐄': ['cow', 'cows'], '🐔': ['chicken', 'chickens'], '🐘': ['elephant', 'elephants'], '🐜': ['ant', 'ants'], '🐞': ['ladybug', 'ladybugs'], '🐨': ['koala', 'koalas'], '🐭': ['mouse', 'mice'],
  '🐯': ['tiger', 'tigers'], '🐰': ['bunny', 'bunnies'], '🐱': ['cat', 'cats'], '🐴': ['horse', 'horses'], '🐵': ['monkey', 'monkeys'], '🐶': ['dog', 'dogs'], '🐷': ['pig', 'pigs'],
  '🐸': ['frog', 'frogs'], '🐻': ['bear', 'bears'], '🐼': ['panda', 'pandas'], '🦁': ['lion', 'lions'], '🦉': ['owl', 'owls'], '🦊': ['fox', 'foxes'], '🦋': ['butterfly', 'butterflies'],
  '🦫': ['beaver', 'beavers'], '🕷': ['spider', 'spiders'], '🐊': ['crocodile', 'crocodiles'], '🐋': ['whale', 'whales'], '🚀': ['rocket', 'rockets'], '🚗': ['car', 'cars'], '🚌': ['bus', 'buses'],
  '🚲': ['bike', 'bikes'], '🚂': ['train', 'trains'], '🚁': ['helicopter', 'helicopters'], '🚒': ['fire truck', 'fire trucks'], '⛵': ['sailboat', 'sailboats'], '🧸': ['teddy bear', 'teddy bears'],
  '🤖': ['robot', 'robots'], '🪀': ['yo-yo', 'yo-yos'], '🔴': ['red circle', 'red circles'], '🔵': ['blue circle', 'blue circles'], '🟢': ['green circle', 'green circles'], '🟡': ['yellow circle', 'yellow circles'],
  '🟠': ['orange circle', 'orange circles'], '🟣': ['purple circle', 'purple circles'], '🟤': ['brown circle', 'brown circles'], '⚪': ['white circle', 'white circles'], '🟦': ['blue square', 'blue squares'],
  '🔷': ['blue diamond', 'blue diamonds'], '🔺': ['red triangle', 'red triangles'], '🔔': ['bell', 'bells'], '🗝': ['key', 'keys'], '🌙': ['moon', 'moons'], '☀': ['sun', 'suns'], '❄': ['snowflake', 'snowflakes'],
};
const ORD = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const pict = /\p{Extended_Pictographic}\uFE0F?/gu;

export function speechText(input: string): string {
  let t = input;
  // Emoji: "How many 🍒" / "3 🍎" → plural; "one 🍌"/"a 🍬"/"1 🍎" → singular. Unknown pictures are dropped.
  t = t.replace(/(\b(?:\d+|one|a|an|many|How many|all the|some|these|those)\s+)?(\p{Extended_Pictographic})\uFE0F?/gu, (_m, pre: string | undefined, e: string) => {
    const names = EMOJI[e];
    if (!names) return pre ?? '';
    const singular = !!pre && /^(1|one|a|an)\s+$/i.test(pre);
    const word = singular ? names[0] : pre ? names[1] : names[0];
    return `${pre && /^(a|an)\s+$/i.test(pre) ? (/^[aeiou]/.test(word) ? 'an ' : 'a ') : pre ?? ''}${word}`;
  });
  t = t.replace(pict, '');
  t = t.replace(/(\d+)\s*¢/g, (_m, n) => `${n} ${n === '1' ? 'cent' : 'cents'}`);
  t = t.replace(/\$(\d+)(?:\.(\d{2}))?/g, (_m, d: string, c?: string) => `${d} ${d === '1' ? 'dollar' : 'dollars'}${c && c !== '00' ? ` and ${Number(c)} ${c === '01' ? 'cent' : 'cents'}` : ''}`);
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (m, n) => ORD[Number(n)] ?? m);
  t = t.replace(/(\d)\s*×\s*(\d)(?=\s*(box|grid|board))/g, '$1 by $2');
  t = t.replace(/\s*×\s*/g, ' times ').replace(/\s*÷\s*/g, ' divided by ').replace(/\s*[−–](?=\s*\d)/g, ' minus ').replace(/\s*\+\s*/g, ' plus ')
    .replace(/\s*≠\s*/g, ' does not equal ').replace(/\s*=\s*/g, ' equals ').replace(/\s*<\s*/g, ' is less than ').replace(/\s*>\s*/g, ' is greater than ');
  t = t.replace(/(?:_+|□|\?)(?=\s*(?:[,.]|plus|minus|times|equals|$))/g, (m, off, s) => (m === '?' && /\w/.test(s[off - 1] ?? '') ? '?' : ' blank'));
  t = t.replace(/,?\s*…/g, ', and so on.').replace(/→/g, ', then ').replace(/\s{2,}/g, ' ').trim();
  return t;
}
