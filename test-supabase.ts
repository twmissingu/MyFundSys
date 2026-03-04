import { createClient } from '@supabase/supabase-js';

// 从 .env 文件读取的配置
const supabaseUrl = 'https://xeddgyxugpwmgwmeetme.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZGRneXh1Z3B3bWd3bWVldG1lIiwicm9slZSI6ImFub24iLCJpYXQiOjE3NzI1NzI1MDQsImV4cCI6MjA4ODE0ODUwNH0.QyOLwVv-M3viTOt1CPMrLbVX8ZpwhIufUqApeHAAPtQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
  console.log('🧪 开始 Supabase 连接测试...\n');

  // 1. 测试连接
  console.log('1️⃣ 测试基础连接...');
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    console.log('✅ 连接成功');
  } catch (err) {
    console.log('❌ 连接失败:', err.message);
    return;
  }

  // 2. 测试 funds 表
  console.log('\n2️⃣ 测试 funds 表...');
  try {
    const { data: funds, error } = await supabase
      .from('funds')
      .select('*')
      .limit(5);
    if (error) throw error;
    console.log(`✅ funds 表正常，共查询到 ${funds.length} 条记录`);
    if (funds.length > 0) {
      console.log('   示例数据:', funds[0].code, funds[0].name);
    }
  } catch (err) {
    console.log('❌ funds 表查询失败:', err.message);
  }

  // 3. 测试 strategies 表
  console.log('\n3️⃣ 测试 strategies 表...');
  try {
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*');
    if (error) throw error;
    console.log(`✅ strategies 表正常，共 ${strategies.length} 条策略`);
    strategies.forEach(s => console.log(`   - ${s.name}`));
  } catch (err) {
    console.log('❌ strategies 表查询失败:', err.message);
  }

  // 4. 测试 holdings 表 (需要登录，预期会失败)
  console.log('\n4️⃣ 测试 holdings 表 (RLS 保护)...');
  try {
    const { data: holdings, error } = await supabase
      .from('holdings')
      .select('*');
    if (error) throw error;
    console.log(`✅ holdings 表正常，查询到 ${holdings.length} 条记录`);
  } catch (err) {
    if (err.message.includes('JWT') || err.message.includes('auth')) {
      console.log('⚠️  holdings 表受 RLS 保护，需要登录后才能访问 (这是正常的)');
    } else {
      console.log('❌ holdings 表查询失败:', err.message);
    }
  }

  // 5. 测试 transactions 表 (需要登录)
  console.log('\n5️⃣ 测试 transactions 表 (RLS 保护)...');
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*');
    if (error) throw error;
    console.log(`✅ transactions 表正常`);
  } catch (err) {
    if (err.message.includes('JWT') || err.message.includes('auth')) {
      console.log('⚠️  transactions 表受 RLS 保护，需要登录后才能访问 (这是正常的)');
    } else {
      console.log('❌ transactions 表查询失败:', err.message);
    }
  }

  // 6. 测试 realtime
  console.log('\n6️⃣ 测试 Realtime 功能...');
  try {
    const channel = supabase.channel('test-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings' }, (payload) => {
        console.log('Realtime 收到数据:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 订阅成功');
        }
      });
    
    // 5秒后取消订阅
    setTimeout(() => {
      supabase.removeChannel(channel);
      console.log('   Realtime 测试完成');
    }, 5000);
  } catch (err) {
    console.log('❌ Realtime 测试失败:', err.message);
  }

  console.log('\n✨ 测试完成!');
}

runTests();
