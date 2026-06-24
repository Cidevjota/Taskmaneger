import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const url = 'https://quyoeoftqackmrjxpreb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1eW9lb2Z0cWFja21yanhwcmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMTE5ODMsImV4cCI6MjA5NzU4Nzk4M30.SsBi756P6mWy2zmHfsiYdYJLfVDQtNbIDU9OLZRyZRk';

const supabase = createClient(url, key);

async function test() {
  console.log("Testing fetch all users...");
  const { data: all, error: allErr } = await supabase.from('users_profile').select('*');
  console.log("ALL USERS:", all, allErr);

  console.log("Testing login...");
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('email', 'cidnei@uchoempreendimentos.com.br')
    .maybeSingle();

  console.log("LOGIN RESULT:", data, error);
}

test();
