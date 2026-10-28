// Shows an error or success message under a form.
export default function FormMessage({ state }) {
  if (!state) return null;
  if (state.error) return <p className="message error">{state.error}</p>;
  if (state.success) return <p className="message success">{state.success}</p>;
  return null;
}
