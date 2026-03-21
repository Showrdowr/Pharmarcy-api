export type InteractiveQuestionLike = {
  id?: number | string | null;
  displayAtSeconds?: number | null;
  sortOrder?: number | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type InteractiveAnswerLike = {
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

function toTimestamp(value?: string | Date | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortInteractiveQuestions<T extends InteractiveQuestionLike>(questions: T[]) {
  return [...questions].sort((left, right) => {
    const byDisplayTime = Number(left.displayAtSeconds ?? 0) - Number(right.displayAtSeconds ?? 0);
    if (byDisplayTime !== 0) {
      return byDisplayTime;
    }

    const bySortOrder = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
    if (bySortOrder !== 0) {
      return bySortOrder;
    }

    return Number(left.id ?? 0) - Number(right.id ?? 0);
  });
}

export function isInteractiveQuestionAnswered(
  question: InteractiveQuestionLike,
  answer?: InteractiveAnswerLike | null,
) {
  if (!answer) {
    return false;
  }

  return toTimestamp(answer.updatedAt ?? answer.createdAt ?? null)
    >= toTimestamp(question.updatedAt ?? question.createdAt ?? null);
}
