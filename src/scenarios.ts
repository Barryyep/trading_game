export type Scenario = {
  id: string;
  prompt: string;
  unit: string;
  trueValue: number; // internal mark/settle value
  min?: number;
  max?: number;
  hint?: string;
  tags?: string[];
};

// Clean-room, original content. Values are approximate and only used to score the game.
export const scenarios: Scenario[] = [
  {
    id: 'hollywood-sign-height',
    prompt: 'How tall are the letters in the Hollywood sign?',
    unit: 'feet',
    trueValue: 45,
    min: 10,
    max: 200,
    hint: 'Think “a few stories tall”.',
    tags: ['LA', 'facts']
  },
  {
    id: 'us-pop',
    prompt: 'What is the population of the United States (roughly)?',
    unit: 'millions',
    trueValue: 335,
    min: 50,
    max: 600,
    hint: 'Order-of-magnitude is what matters.',
    tags: ['facts']
  },
  {
    id: 'sp500-members',
    prompt: 'How many companies are in the S&P 500?',
    unit: 'companies',
    trueValue: 500,
    min: 100,
    max: 1000,
    hint: 'It’s in the name.',
    tags: ['facts', 'markets']
  },
  {
    id: 'nyc-taxis',
    prompt: 'How many yellow taxis operate in New York City (roughly)?',
    unit: 'taxis',
    trueValue: 13000,
    min: 1000,
    max: 100000,
    hint: 'Tens of thousands at most.',
    tags: ['guesstimate']
  },
  {
    id: 'golf-balls-in-747',
    prompt: 'How many golf balls could fit inside a Boeing 747 (order-of-magnitude)?',
    unit: 'balls',
    trueValue: 20000000,
    min: 100000,
    max: 200000000,
    hint: 'Volume estimation.',
    tags: ['guesstimate']
  },
  {
    id: 'coffee-cups-us-daily',
    prompt: 'How many cups of coffee are consumed in the US per day (roughly)?',
    unit: 'million cups/day',
    trueValue: 400,
    min: 10,
    max: 2000,
    hint: 'Population × cups per person.',
    tags: ['guesstimate']
  },
  {
    id: 'smartphone-price',
    prompt: 'What’s a typical new smartphone price in the US (roughly)?',
    unit: 'USD',
    trueValue: 900,
    min: 100,
    max: 2000,
    hint: 'Not the budget model.',
    tags: ['facts', 'consumer']
  },
  {
    id: 'tesla-marketcap',
    prompt: 'What’s Tesla’s market cap (roughly, pick a reasonable ballpark)?',
    unit: 'billion USD',
    trueValue: 600,
    min: 50,
    max: 3000,
    hint: 'This changes a lot; use a ballpark.',
    tags: ['markets', 'guesstimate']
  }
];
