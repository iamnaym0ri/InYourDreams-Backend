// db.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

console.log("🔗 Supabase client initialized!");

export async function createUser(username) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ username }, { onConflict: ['username'] })
    .select()
    .single();

  if (error) {
    console.error("❌ Error creating user:", error.message);
    throw error;
  }

  console.log("✅ Username created or exists in DB!");
  return data;
}

export async function getUser(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error) {
    console.error("❌ Error fetching user:", error.message);
    throw error;
  }

  return data;
}

export async function incrementUsage(username) {
  const { data, error } = await supabase.rpc('increment_daily_usage', { u_name: username });

  if (error) {
    console.error("❌ Error incrementing usage:", error.message);
    throw error;
  }

  return data;
}

export async function resetUsageIfNeeded(username) {
  const { data, error } = await supabase.rpc('reset_usage_if_needed', { u_name: username });

  if (error) {
    console.error("❌ Error resetting usage:", error.message);
    throw error;
  }

  return data;
}

export async function updateUserPlan(username, plan, subscription_id = null, payg_item_id = null, customer_id = null, custom_limit = null) {
  const updateData = { plan };
  if (subscription_id) updateData.subscription_id = subscription_id;
  if (payg_item_id) updateData.payg_item_id = payg_item_id;
  if (customer_id) updateData.customer_id = customer_id;
  if(custom_limit) updateData.custom_limit = custom_limit;

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('username', username)
    .select()
    .single();

  if (error) {
    console.error("❌ Error updating plan:", error.message);
    throw error;
  }

  return data;
}


