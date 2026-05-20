export function parseModelId(
  modelId: string,
): [provider: string, model: string] {
  const slashIndex = modelId.indexOf("/");
  if (slashIndex === -1) return ["", modelId];
  return [modelId.slice(0, slashIndex), modelId.slice(slashIndex + 1)];
}

export function formatModelId(model: { id: string; provider: string }): string {
  return `${model.provider}/${model.id}`;
}

export function getModelLabels(
  available: { id: string; provider: string }[],
): string[] {
  return available.map(formatModelId);
}
