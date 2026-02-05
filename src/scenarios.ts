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
  // LA / fun facts
  { id: 'hollywood-sign-height', prompt: 'How tall are the letters in the Hollywood sign?', unit: 'feet', trueValue: 45, min: 10, max: 200, hint: 'Think “a few stories tall”.', tags: ['LA', 'facts'] },
  { id: 'la-to-sf', prompt: 'What is the driving distance from Los Angeles to San Francisco (roughly)?', unit: 'miles', trueValue: 380, min: 50, max: 900, hint: 'Order-of-magnitude: a few hundred miles.', tags: ['LA', 'facts'] },

  // Big numbers
  { id: 'us-pop', prompt: 'What is the population of the United States (roughly)?', unit: 'millions', trueValue: 335, min: 50, max: 600, hint: 'Order-of-magnitude is what matters.', tags: ['facts'] },
  { id: 'world-pop', prompt: 'What is the population of the world (roughly)?', unit: 'billions', trueValue: 8.1, min: 1, max: 20, hint: 'Single-digit billions.', tags: ['facts'] },
  { id: 'sp500-members', prompt: 'How many companies are in the S&P 500?', unit: 'companies', trueValue: 500, min: 100, max: 1000, hint: 'It’s in the name.', tags: ['facts', 'markets'] },
  { id: 'dow-members', prompt: 'How many companies are in the Dow Jones Industrial Average?', unit: 'companies', trueValue: 30, min: 5, max: 100, hint: 'Small index.', tags: ['facts', 'markets'] },

  // Market-ish guesstimates
  { id: 'spy-price', prompt: 'What’s a reasonable ballpark for SPY price (any recent era)?', unit: 'USD', trueValue: 500, min: 50, max: 1500, hint: 'Broad index ETF price level.', tags: ['markets', 'guesstimate'] },
  { id: 'tesla-marketcap', prompt: 'What’s Tesla’s market cap (roughly, pick a reasonable ballpark)?', unit: 'billion USD', trueValue: 600, min: 50, max: 3000, hint: 'This changes a lot; use a ballpark.', tags: ['markets', 'guesstimate'] },
  { id: 'aapl-marketcap', prompt: 'What’s Apple’s market cap (roughly, pick a reasonable ballpark)?', unit: 'trillion USD', trueValue: 3.0, min: 0.2, max: 6.0, hint: 'One of the biggest companies.', tags: ['markets', 'guesstimate'] },

  // Everyday consumer
  { id: 'smartphone-price', prompt: 'What’s a typical new smartphone price in the US (roughly)?', unit: 'USD', trueValue: 900, min: 100, max: 2000, hint: 'Not the budget model.', tags: ['facts', 'consumer'] },
  { id: 'coffee-cups-us-daily', prompt: 'How many cups of coffee are consumed in the US per day (roughly)?', unit: 'million cups/day', trueValue: 400, min: 10, max: 2000, hint: 'Population × cups per person.', tags: ['guesstimate'] },
  { id: 'uber-rides-us-daily', prompt: 'How many rides (Uber/Lyft combined) happen in the US per day (roughly)?', unit: 'million rides/day', trueValue: 6, min: 0.2, max: 30, hint: 'Millions, not hundreds of millions.', tags: ['guesstimate'] },

  // Classic interview-style guesstimates
  { id: 'nyc-taxis', prompt: 'How many yellow taxis operate in New York City (roughly)?', unit: 'taxis', trueValue: 13000, min: 1000, max: 100000, hint: 'Tens of thousands at most.', tags: ['guesstimate'] },
  { id: 'golf-balls-in-747', prompt: 'How many golf balls could fit inside a Boeing 747 (order-of-magnitude)?', unit: 'balls', trueValue: 20000000, min: 100000, max: 200000000, hint: 'Volume estimation.', tags: ['guesstimate'] },
  { id: 'pianos-in-chicago', prompt: 'How many piano tuners are in Chicago (order-of-magnitude)?', unit: 'tuners', trueValue: 125, min: 5, max: 2000, hint: 'Fermi estimate.', tags: ['guesstimate'] },
  { id: 'pizza-slices-nyc-daily', prompt: 'How many slices of pizza are sold in NYC per day (roughly)?', unit: 'million slices/day', trueValue: 1.0, min: 0.05, max: 10, hint: 'Population × slices per person.', tags: ['guesstimate'] },
  { id: 'tennis-balls-bus', prompt: 'How many tennis balls could fit in a school bus (order-of-magnitude)?', unit: 'balls', trueValue: 500000, min: 10000, max: 10000000, hint: 'Volume estimation.', tags: ['guesstimate'] },

  // Tech-ish
  { id: 'ipv4-space', prompt: 'How many unique IPv4 addresses exist?', unit: 'billion addresses', trueValue: 4.29, min: 0.5, max: 10, hint: '2^32.', tags: ['facts', 'tech'] },
  { id: 'bytes-in-gb', prompt: 'How many bytes are in 1 gigabyte (in decimal GB)?', unit: 'bytes', trueValue: 1_000_000_000, min: 1, max: 10_000_000_000, hint: 'Decimal GB, not GiB.', tags: ['facts', 'tech'] },

  // Finance facts
  { id: 'trading-days', prompt: 'How many trading days are there in a typical year (US equities)?', unit: 'days', trueValue: 252, min: 150, max: 365, hint: 'Common quant number.', tags: ['facts', 'markets'] },
  { id: 'fed-funds', prompt: 'What’s a reasonable ballpark for the US Fed Funds rate (in %)?', unit: '%', trueValue: 5.0, min: 0.0, max: 20.0, hint: 'Depends on era; pick a ballpark.', tags: ['markets', 'guesstimate'] },
];
