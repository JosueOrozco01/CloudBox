BEGIN;
CREATE TABLE public.admin_notification_read (
  id_usuario integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  id_log bigint NOT NULL REFERENCES public."LogAuditoria"(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_usuario, id_log)
);
CREATE TABLE public.support_ticket (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 150),
  category text NOT NULL CHECK (category IN ('files','sharing','storage','payments','security','other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.support_message (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.support_ticket(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_user_date ON public.support_ticket(id_usuario, created_at DESC);
CREATE INDEX support_message_ticket ON public.support_message(ticket_id, id);
ALTER TABLE public.admin_notification_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_message ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_notification_read, public.support_ticket, public.support_message FROM anon, authenticated;
GRANT ALL ON public.admin_notification_read, public.support_ticket, public.support_message TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_ticket_id_seq, public.support_message_id_seq TO service_role;
CREATE FUNCTION public.cloudbox_create_ticket(p_user integer, p_subject text, p_category text, p_message text) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ticket bigint;
BEGIN
 INSERT INTO public.support_ticket(id_usuario, subject, category) VALUES(p_user,p_subject,p_category) RETURNING id INTO ticket;
 INSERT INTO public.support_message(ticket_id,id_usuario,message) VALUES(ticket,p_user,p_message);
 RETURN ticket;
END;
$$;
REVOKE ALL ON FUNCTION public.cloudbox_create_ticket(integer,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_create_ticket(integer,text,text,text) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('avatars','avatars',false,2097152,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
COMMIT;
