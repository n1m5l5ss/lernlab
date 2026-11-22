// The downloadable CSV template: the columns from docs/FORMAT.md and four example cards (a plain card,
// a multiple-choice card, a language card and an explain card with its key points). Only `front` is required; every other column may stay empty.
// Column names and example cards are file content, not interface text, so they stay in English.

export const CSV_TEMPLATE_NAME = 'lernlab-template.csv';

export const CSV_TEMPLATE = `${[
  'front,back,example,explanation,category,tags,image,image_alt,audio,type,choices,correct,steps,alt_answers,variants,corrections,key_points',
  'Amazon S3,Object storage for any amount of data,Store backups in S3,,Storage,aws storage,s3.png,The S3 bucket logo,,,,,,,apply: Which AWS service keeps years of photos cheaply? | analyse: Your app outgrows the disk of one server. Where do its files go?,,',
  'Which two services are serverless?,,,Lambda and Fargate need no server management.,Compute,aws,,,,mcq,EC2|Lambda|Fargate|RDS,2|3,,,,Many people think EC2 is serverless. In fact you still patch and scale its servers yourself.,',
  'der Hund,dog,Der <b>Hund</b> bellt.,,der,german a1,,,hund.mp3,,,,,the dog,,,',
  "Why do we have seasons?,Earth's tilted axis changes how directly sunlight hits each half.,,,Earth,science why,,,,explain,,,,,,,Earth is tilted|The tilt changes the angle of sunlight|Not the distance to the sun",
].join('\n')}\n`;
