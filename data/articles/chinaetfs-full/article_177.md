---
title: 定投是否真的如此美妙
date: 2008-01-07
url: http://www.chinaetfs.cn/a/177.html
source: chinaetfs.cn
category: 网易博客
---

周末对“基金定投”做了一次深入研究。对于一直以来被基金公司所宣传的：“长期投资每年15%收益，20年后百万富翁”这样的说法，我的研究结果显示，并非如此。

[周末](http://www.chinaetfs.cn/a/142.html)

下面我极其简单的说说我的研究，如果你定投，希望你能稍微有点耐心看看。

美国股市几十年历史，平均每年收益11%。我们把中国当成一个高增长的国家，给他每年15%股市增长。那么我们来看看吧。

如果你1993年开始定投指数，那么到2005年，你的收益将是：0。因为这13年，股市没有增长，谈不上15%年收益。

如果从2005年开始，计算每年15%收益，那么到2017年，指数应该是5350点。就是说，从现在开始到2017年，指数不会增长。

就是说如果你错过了06 07的大牛市，你将忍受10年的0增长。

这只是理论上而已，并不是说未来10年一定是0增长。但每年15%这个说法，您不能完全相信。

下面的图，是用matlab软件模拟的从1993年开始定投，到现在的收益。

绿线是大盘指数，黑线是投入的钱，红线是投入后得到的资产。

分析这几条线，你可以明显看出，如果你没有在2001年做出高抛动作，到5年后的2006年，实际上你没有得到任何收益。你的投入和资本一样。

[6年](http://www.chinaetfs.cn/a/1189.html)

当然，后面的大牛市让你赚了钱。但，这也许跟2001年后的结果一样。

如果你是从牛市顶峰开始定投。。那么。。。下场会更加悲惨一点。。

那么，问题出在哪里了呢???

问题就在于:定投确实如宣传所说，在跌下来的时候你在低位补了仓，在高位实现了收益。但是，它还有另一层意思就是：你在高位买了贵的，跌下来的时候你就亏损了。

那么应该怎么做??

我的想法是，定投，请在高位少定投，在低位多定投。或者干脆在高位不定投，在低位把高位停止的定投钱一次买入。或者更狠点，高位卖出，低位买进。

实际上，最后一种办法很难，因为你不知道什么时候是高，什么时候是低。我建议用第二种方法。

那么什么时候是高位呢?我建议你关注股市整体市盈率。如果沪深300整体市盈率突破45，那么就不要投入了，攒下钱，在市盈率在25以下的时候一次投入。然后在低位定投。

matlab计算源程序为：

function dingtou_6()

% the program to calculate “dingtou” case

fp=fopen(‘dingtou_6.in’,’r’);

Indata=fscanf(fp,’%f’,[1,inf]); % monthly Shanghai index, starting from 
1993

fclose(fp);

Indata;

count=length(Indata)

forii=1:count

[ii](http://www.chinaetfs.cn/a/100.html)

time(ii)=1993+(ii-1)/12; % starting from year 1993

index(ii)=Indata(1,ii); % Shanghai index

end

a(1)=1;

for ii=2:count

a(ii)=a(ii-1)*index(ii)/index(ii-1)+1;

end

fp=fopen(‘dingtou_6.out’,’w’);

fprintf(fp,’time invest outcome indexn’);

for ii=1:count

fprintf(fp,’%f %f %f %fn’,time(ii),ii,a(ii),index(ii));

end

fclose(fp);
