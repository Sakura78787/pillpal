create index notifications_actor_user_idx
  on public.notifications (actor_user_id)
  where actor_user_id is not null;

create index notifications_care_authorization_idx
  on public.notifications (care_authorization_id)
  where care_authorization_id is not null;
