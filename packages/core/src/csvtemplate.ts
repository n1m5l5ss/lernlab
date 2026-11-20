// The downloadable CSV template: the columns from docs/FORMAT.md and three example cards (a plain card,
// a multiple-choice card and a language card). Only `front` is required; every other column may stay empty.
// Column names and example cards are file content, not interface text, so they stay in English.

export const CSV_TEMPLATE_NAME = 'lernlab-template.csv';

export const CSV_TEMPLATE = `${[
  'front,back,example,explanation,category,tags,image,audio,type,choices,correct,steps,alt_answers',
  'Amazon S3,Object storage for any amount of data,Store backups in S3,,Storage,aws storage,s3.png,,,,,,',
  'Which two services are serverless?,,,Lambda and Fargate need no server management.,Compute,aws,,,mcq,EC2|Lambda|Fargate|RDS,2|3,,',
  'der Hund,dog,Der <b>Hund</b> bellt.,,der,german a1,,hund.mp3,,,,,the dog',
].join('\n')}\n`;
