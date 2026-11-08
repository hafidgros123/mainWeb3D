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

  {
    id: 'is-ranni-a-baddie',
    prompt: 'Is Ranni a baddie?',
    choices: ['yea', 'absolutly', 'affirmative', 'what  ?? no , wtf is this question'],
    correctIndices: [0, 1, 2],
  },

  {
    id: 'more-fps',
    prompt: 'What gives more FPS?',
    choices: ['gpu and cpu (correct answer but i made it wrong so dont press it)', 'rgb', 'the mandatory anime figure', 'better monitor'],
    correctIndices: [1, 2],
  },

  {
    id: 'cat-names',
    prompt: 'Write all five of my cats’ names. Hint: one is called "petit", and the second is also "petit".',
    answerType: 'text',
    correctAnswers: ['petit', 'petit', 'petit', 'petit', 'petit'],
    unlimitedTime: true,
  },
]

export function getRandomGambleQuestion() {
  const question = GAMBLE_QUESTIONS[Math.floor(Math.random() * GAMBLE_QUESTIONS.length)]
  if (question.stages) {
    return {
      ...question,
      stages: question.stages.map((stage) => ({ ...stage, choices: [...stage.choices] })),
    }
  }

  return {
    ...question,
    ...(question.choices ? { choices: [...question.choices] } : {}),
    ...(question.correctIndices ? { correctIndices: [...question.correctIndices] } : {}),
    ...(question.correctAnswers ? { correctAnswers: [...question.correctAnswers] } : {}),
  }
}
