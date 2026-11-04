export const GAMBLE_QUESTIONS = [
  {
    id: 'nine-eleven-year',
    prompt: 'What year did 9/11/2001 happen?',
    choices: ['2001.68975667777', '2001.5', '2000', '2001.69415145'],
    correctIndex: 3,
  },
  {
    id: 'enemy-driving',
    stages: [
      {
        prompt: 'Do I run over this useless piece of human being (anas), or do I drive around him??',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
      {
        prompt: 'I dont know... think about the gas prices.',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
      {
        prompt: 'Yeah, but then Id have to back up and go around... and yeah, it all just kind of feels like a waste of time, doesnt it?',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
      {
        prompt: 'Im not going to do that.',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
      {
        prompt: 'No, dont feel like it. Dont feel like....',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
      {
        prompt: 'Final try. Do you drive into him or turn around and drive past him?',
        choices: ['Drive into him', 'Turn around and drive past him', 'Turn around and drive past him', 'Turn around and drive past him'],
      },
    ],
    correctIndex: 0,
  },
]

export function getRandomGambleQuestion() {
  const question = GAMBLE_QUESTIONS[Math.floor(Math.random() * GAMBLE_QUESTIONS.length)]
  return question.id === 'enemy-driving'
    ? { ...question, stages: question.stages.map((stage) => ({ ...stage, choices: [...stage.choices] })) }
    : { ...question, choices: [...question.choices] }
}
