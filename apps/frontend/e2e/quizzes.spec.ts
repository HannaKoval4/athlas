import type { AttemptResult } from '@atlas/shared';
import { expect, userTest as test } from './fixtures.ts';
import type { Page } from '@playwright/test';

// Runs against the seeded dev database: Greece in Antiquity has a pool of 17 questions.

async function answerEveryQuestion(page: Page) {
  const questions = page.getByTestId('quiz-question');
  await expect(questions).toHaveCount(10);
  for (let i = 0; i < 10; i++) await questions.nth(i).locator('input').first().check();
}

test.describe('Era quiz', () => {
  test('the culture panel opens the quiz of the era chosen on the map', async ({ page }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450');

    const quizzes = page.getByTestId('culture-quizzes');
    await expect(quizzes.getByRole('listitem').first()).toContainText('выбрана на карте');
    await quizzes.getByTestId('culture-quiz-antiquity').getByRole('link').click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Древняя Греция в эпоху Античности',
    );
    await expect(page.getByTestId('quiz-page')).toContainText('70 %');
  });

  test('ten questions, finish only when all are answered, then the review', async ({ page }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450');
    await page.getByTestId('culture-quiz-antiquity').getByRole('link').click();
    await page.getByTestId('quiz-start').click();

    await expect(page.getByTestId('quiz-submit')).toBeDisabled();
    await answerEveryQuestion(page);
    await expect(page.getByTestId('quiz-answered')).toHaveText('Отвечено: 10 из 10');
    await page.getByTestId('quiz-submit').click();

    await expect(page).toHaveURL(/\/quizzes\/attempts\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('attempt-score')).toContainText(/\d+ из 10/);
    const right = await page.getByTestId('review-right').count();
    const wrong = page.getByTestId('review-wrong');
    await expect(wrong).toHaveCount(10 - right);
    if (right < 10) {
      // BR-14: the correct option, the explanation and the card to revisit.
      await expect(wrong.first()).toContainText('правильный ответ');
      await expect(wrong.first().getByRole('link', { name: /^Повторить:/ })).toBeVisible();
    }

    await page.getByTestId('attempt-retry').click();
    await expect(page.getByTestId('quiz-progress')).toContainText('Лучший результат');
  });

  test('a passed attempt shows the new achievement', async ({ page }) => {
    // The correct answers are not known to the browser, so the server's answer is adjusted.
    await page.route(/\/api\/quizzes\/attempts\/[^/]+\/submit$/, async (route) => {
      const response = await route.fetch();
      const result = (await response.json()) as AttemptResult;
      await route.fulfill({
        response,
        json: {
          ...result,
          passed: true,
          newAchievement: {
            code: `ERA_STUDIED:${result.quiz.id}`,
            titleKey: 'achievements.eraStudied',
            quiz: null,
            earnedAt: new Date().toISOString(),
          },
        },
      });
    });
    await page.goto('/cultures/ancient-egypt?era=early-antiquity&year=-2500');
    await page.getByTestId('culture-quiz-early-antiquity').getByRole('link').click();
    await page.getByTestId('quiz-start').click();
    await answerEveryQuestion(page);
    await page.getByTestId('quiz-submit').click();

    await expect(page.getByTestId('new-achievement')).toContainText(
      'Новое достижение «Эпоха изучена»: Древний мир · Древний Египет',
    );
  });
});
