import { Plugin } from "@opencode/plugin";

// Mirrors every skill with a description as an in-memory `/skill:<id>` command.
// Executing a mirror re-submits the prompt with the skill attached natively.
export default Plugin.define({
  id: "skills-as-slash",
  async setup(ctx) {
    let registration: { dispose: () => Promise<void> } | undefined;

    // Registrations are replaced wholesale: the transform callback captures
    // its skill snapshot, so updates need dispose + re-add, not reload().
    async function mirror(): Promise<void> {
      const { data } = await ctx.skill.list();
      const mirrored = data
        .filter((skill) => Boolean(skill.description))
        .sort((a, b) => a.id.localeCompare(b.id));
      await registration?.dispose();
      registration = await ctx.command.transform((editor) => {
        for (const skill of mirrored) {
          const id = skill.id;
          const description = skill.description ?? "";
          editor.add({
            name: `skill:${id}`,
            description,
            execute: async ({ sessionID, prompt, delivery }) => {
              await ctx.session.prompt({
                sessionID,
                text: prompt.text,
                skills: [{ id }],
                delivery,
              });
            },
          });
        }
      });
    }

    await mirror();

    // The event loop awaits each re-registration, so mirrors never overlap.
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          if (event.type === "skill.updated") await mirror();
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    })();

    return async () => {
      controller.abort();
      await registration?.dispose();
      registration = undefined;
    };
  },
});
