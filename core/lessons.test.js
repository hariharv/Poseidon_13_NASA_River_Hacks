import { describe, it, expect } from 'vitest';
import { LESSONS, lessonFor, allFacts, shuffleQuiz } from './lessons.js';

const BUILT = ['hermes', 'odysseus', 'dioscuri', 'hera', 'apollo'];

describe('LESSONS: what each stage teaches about being an astronaut', () => {
  it('every built stage has a lesson', () => {
    for (const id of BUILT) expect(lessonFor(id), id).toBeTruthy();
  });

  it('every fact is short, kid-sized and has a real source link', () => {
    for (const id of BUILT) {
      const { facts } = lessonFor(id);
      expect(facts.length, id).toBeGreaterThanOrEqual(4);
      for (const f of facts) {
        expect(f.text.length, f.text).toBeLessThanOrEqual(140);
        expect(f.url, f.text).toMatch(/^https:\/\//);
        expect(f.source, f.text).toBeTruthy();
      }
    }
  });

  it('every stage names the real astronaut skill it practises, and a tip', () => {
    for (const id of BUILT) {
      expect(lessonFor(id).skill).toBeTruthy();
      expect(lessonFor(id).tip).toBeTruthy();
    }
  });

  it('every debrief question has 3 answers and exactly one right one', () => {
    for (const id of BUILT) {
      const { quiz } = lessonFor(id);
      expect(quiz.options.length).toBe(3);
      expect(quiz.options.filter((o) => o.correct).length).toBe(1);
      expect(quiz.explain).toBeTruthy();
    }
  });

  it('unknown stages have no lesson (and nothing breaks)', () => {
    expect(lessonFor('nope')).toBe(null);
  });

  it('allFacts gathers every fact once', () => {
    const n = Object.values(LESSONS).reduce((sum, l) => sum + l.facts.length, 0);
    expect(allFacts().length).toBe(n);
  });

  it('shuffleQuiz keeps the same answers, so the right one moves around but stays right', () => {
    const quiz = lessonFor('hermes').quiz;
    const shuffled = shuffleQuiz(quiz, () => 0.99);
    expect(shuffled.options.map((o) => o.text).sort()).toEqual(quiz.options.map((o) => o.text).sort());
    expect(shuffled.options.filter((o) => o.correct).length).toBe(1);
  });
});
