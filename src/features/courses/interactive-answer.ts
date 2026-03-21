export type InteractiveChoiceOptionLike = {
  id?: string | null;
  text?: string | null;
};

function normalizeChoiceValue(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveInteractiveChoiceAnswer(
  options: InteractiveChoiceOptionLike[] | undefined,
  answerGiven: string,
) {
  const normalizedAnswer = normalizeChoiceValue(answerGiven);
  if (!normalizedAnswer) {
    return null;
  }

  const normalizedOptions = Array.isArray(options)
    ? options
        .map((option) => ({
          id: normalizeChoiceValue(option.id),
          text: normalizeChoiceValue(option.text),
        }))
        .filter((option) => option.id || option.text)
    : [];

  const matchedById = normalizedOptions.find((option) => option.id === normalizedAnswer);
  if (matchedById) {
    return matchedById.id || matchedById.text || null;
  }

  const matchedByText = normalizedOptions.find((option) => option.text === normalizedAnswer);
  if (matchedByText) {
    return matchedByText.id || matchedByText.text || null;
  }

  return null;
}
