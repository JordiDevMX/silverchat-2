select json_build_object(
 'def', (select pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure)),
 'target1_present', (select position(
    E'  IF p_initial_content IS NULL OR btrim(p_initial_content) = '''' THEN\n    RAISE EXCEPTION ''Initial message cannot be empty'';\n  END IF;'
    in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure))),
 'target2_present', (select position(
    E'  INSERT INTO public.messages(chat_id, sender_id, content)\n    VALUES (v_chat.id, v_user, p_initial_content);'
    in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure))),
 'snippet', (select substring(pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure) from position('p_initial_content IS NULL' in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure)) for 160)),
 'snippet2', (select substring(pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure) from position('INSERT INTO public.messages' in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure)) for 160))
)::text as payload;
