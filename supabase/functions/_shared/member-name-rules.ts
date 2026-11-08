export const KOREAN_SURNAMES=[
 '김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','전','홍','유','고','문','양','손','배','백','허','남','심','노','하','곽','성','차','주','우','구','민','진','지','엄','채','원','천','방','공','현','함','변','염','여','추','도','소','석','선','설','마','길','연','위','표','명','기','반','왕','금','옥','육','인','맹','제','모','탁','국','어','은','편','용','예','봉','경','사','부','복','태','목','형','계','피','두','감','음','빈','동','온','호','범','좌','팽','간','단','견','시','가','갈','승','순',
 '남궁','황보','제갈','선우','독고','서문','사공','동방','어금',
];

// These are spelling rules, not a school roster. Real names are supplied at runtime.
export function memberNameFragments(names:string[]){
 const surnames=[...KOREAN_SURNAMES].sort((a,b)=>b.length-a.length);
 return [...new Set(names.flatMap(raw=>{
  const name=raw.normalize('NFKC').replace(/[\s\p{P}\p{Cf}\d]/gu,'');
  if(name.length<2)return [];
  const terms=[name];
  if(/^[가-힣]{3,4}$/u.test(name)){
   const surname=surnames.find(s=>name.startsWith(s));
   if(surname&&name.length-surname.length>=2)terms.push(name.slice(surname.length));
  }
  return terms;
 }))];
}
