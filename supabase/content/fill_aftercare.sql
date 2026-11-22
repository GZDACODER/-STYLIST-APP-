-- Fills in the aftercare tips (and starter Regular and birthday perks) for
-- the business with Pro ID CL-TPNF. Run once in Supabase -> SQL Editor.
-- Only boxes that are still empty are filled, so nothing you've already
-- written is replaced. Matches services by name: anything with "silk press",
-- "braid", "color"/"colour" or "lash" in it. The list at the end shows the
-- result; edit any of it later in the dashboard (Services, Settings -> Regulars).

with pro as (select id from public.stylists where pro_code = 'CL-TPNF'),
tips(pattern, tip) as (values
  ('silk press', $t$Wrap your hair every night with a satin scarf or bonnet, or sleep on a satin pillowcase. Keep it away from water, sweat and humidity, since moisture brings your curls back; wear a shower cap and carry an umbrella. Skip heavy oils and greases, which weigh it down. A tiny drop of light serum on the ends is enough. Avoid extra flat-ironing; if you must, use low heat with a heat protectant. Expect it to last about 1–2 weeks. Book your next press or a wash and deep condition then.$t$),
  ('braid', $t$Sleep in a satin bonnet or scarf to keep frizz down. Every few days, mist your scalp lightly with a water-based spray or a little light oil, and don't use heavy grease. Wash every 2 weeks if needed: dilute your shampoo, focus on the scalp, rinse well and let them dry completely so they don't mildew. Don't pull your braids into tight styles for the first few days. Please take them out within 6–8 weeks to protect your edges and avoid matting, and message me if you'd like me to remove them.$t$),
  ('colou?r', $t$Wait at least 48–72 hours before your first wash so the color can set. Use sulfate-free, color-safe shampoo and conditioner, and rinse with cool water. Hot water fades color faster. Deep condition once a week, especially after lightening. Use a heat protectant every time you style with heat, and wear a hat or UV-protecting spray in strong sun. Chlorine and salt water fade color, so wet your hair with clean water first and rinse right after swimming. Book a gloss or touch-up in about 6–8 weeks.$t$),
  ('lash', $t$Keep your lashes completely dry for the first 24 hours: no water, steam, sauna or heavy sweating. After that, wash them every day or two with lash cleanser and a soft brush, then brush them through gently with a clean spoolie. Use oil-free makeup remover and skip mascara, especially waterproof. Don't rub, pull or pick at them, don't use a lash curler, and try not to sleep face-down. Book a fill every 2–3 weeks to keep them full.$t$)
)
update public.services s
set aftercare = t.tip
from tips t, pro
where s.stylist_id = pro.id
  and s.name ~* t.pattern
  and coalesce(s.aftercare, '') = '';

update public.stylists
set regular_perks = case when regular_perks = '' then 'A free deep condition every 5th visit' else regular_perks end,
    birthday_perk = case when birthday_perk = '' then '15% off any visit in your birthday month' else birthday_perk end
where pro_code = 'CL-TPNF';

select s.name as service,
       case when s.aftercare = '' then '(no tip: name did not match)' else left(s.aftercare, 60) || '...' end as aftercare
from public.services s join public.stylists p on p.id = s.stylist_id
where p.pro_code = 'CL-TPNF'
order by s.name;
