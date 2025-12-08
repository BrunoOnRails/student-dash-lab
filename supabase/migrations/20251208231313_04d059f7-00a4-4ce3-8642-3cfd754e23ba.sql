-- Insert missing profile for the user
INSERT INTO public.profiles (user_id, email, full_name)
VALUES ('e597fc4d-877b-44cc-ab86-191bc06bd23c', 'brunocesar_ofc1@hotmail.com', 'Bruno César')
ON CONFLICT (user_id) DO NOTHING;