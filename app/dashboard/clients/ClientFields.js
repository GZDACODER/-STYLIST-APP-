import { CLIENT_STATUSES } from "@/lib/clients";

// The inputs shared by the "add" and "edit" client forms.
export default function ClientFields({ values = {} }) {
  return (
    <>
      <label>
        Name
        <input name="name" type="text" maxLength={100} defaultValue={values.name} required />
      </label>
      <div className="row wrap">
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={30}
            defaultValue={values.phone || ""}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="off"
            maxLength={254}
            defaultValue={values.email || ""}
          />
        </label>
      </div>
      <label>
        Notes (only you see these)
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Likes a low fade, allergic to ammonia"
          defaultValue={values.notes || ""}
        />
      </label>
      <fieldset className="field">
        <legend>Status</legend>
        <div className="segmented">
          {CLIENT_STATUSES.map((s) => (
            <label key={s.value} className={`segment ${s.value}`}>
              <input
                type="radio"
                name="status"
                value={s.value}
                defaultChecked={(values.status || "regular") === s.value}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
