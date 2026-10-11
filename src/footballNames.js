// Spanish and colloquial names used by IPTV providers. Clubs by ESPN id; national teams by ESPN's English name.
// Shared names («Barcelona», «Santos», «Racing», «Liverpool») stay on every club: footballMatchup keeps the pair that
// plays in the same competition, so «Barcelona vs Emelec» is Barcelona SC and «Barcelona vs Real Madrid» is FC Barcelona.
export const CLUB_ALIASES={
 // Europe
 83:['barca','fc barcelona'],86:['real madrid cf'],1068:['atletico madrid','atletico de madrid','atleti'],93:['athletic bilbao','athletic club bilbao'],
 244:['betis'],101:['rayo'],85:['celta','celta de vigo'],90:['deportivo la coruna','depor'],87:['racing de santander','racing santander'],
 103:['ac milan'],110:['inter','inter de milan','inter milan','inter milano'],111:['juve'],104:['roma'],114:['ssc napoli','napoles'],3263:['genova'],
 132:['bayern munchen','bayern de munich','fc bayern'],124:['bvb'],131:['leverkusen','bayer 04'],268:['monchengladbach','borussia monchengladbach'],
 122:['colonia','koln','fc koln'],125:['eintracht'],127:['hamburgo','hamburger sv'],126:['friburgo'],137:['bremen'],11420:['leipzig'],
 160:['paris saint germain','paris sg'],176:['marsella','olympique de marsella','olympique marseille'],167:['olympique lyon','olympique de lyon','olympique lyonnais'],169:['rennes'],
 360:['manchester united','man utd'],382:['manchester city'],367:['tottenham'],393:['nottingham forest'],
 1929:['sl benfica'],437:['porto','oporto'],2250:['sporting lisboa','sporting de lisboa'],433:['sparta praga'],494:['slavia praga'],435:['olympiakos'],
 2790:['salzburg','red bull salzburg'],5807:['union saint gilloise','union st gilloise'],3236:['le havre'],
 // Chile
 4139:['la u','u de chile','universidad de chile'],2688:['colo colo','colo-colo'],885:['u catolica','la catolica','universidad catolica'],6072:['ohiggins','o higgins'],
 10144:['la calera','union la calera'],4129:['everton','everton de vina','everton vina del mar'],5362:['u de concepcion','udec'],8186:['coquimbo'],7427:['nublense'],
 // Argentina
 16:['river','river plate','carp'],5:['boca','boca juniors','cabj'],15:['racing club','racing avellaneda'],11:['independiente','cai'],18:['san lorenzo','casla'],
 21:['velez','velez sarsfield'],14:['newells','newell s','newell s old boys','newells old boys'],17:['rosario central','central'],8:['estudiantes','estudiantes lp','estudiantes de la plata'],
 9:['gimnasia','gimnasia lp','gimnasia la plata','gimnasia y esgrima la plata'],19:['talleres','talleres de cordoba'],4:['belgrano','belgrano de cordoba'],12:['lanus'],10:['huracan'],
 8950:['defensa y justicia','defensa'],3:['argentinos','argentinos juniors'],9785:['atletico tucuman'],
 19685:['estudiantes rio cuarto','estudiantes de rio cuarto'],11989:['central cordoba','central cordoba sde','central cordoba de santiago'],
 // México
 227:['america','club america','las aguilas'],219:['chivas','guadalajara','chivas guadalajara'],218:['cruz azul','la maquina'],233:['pumas','pumas unam','unam'],232:['tigres','tigres uanl'],
 220:['monterrey','rayados'],10125:['xolos','tijuana'],234:['pachuca','tuzos'],223:['toluca','diablos rojos'],225:['santos laguna'],228:['leon'],216:['atlas'],231:['puebla'],229:['necaxa'],222:['queretaro','gallos blancos'],17851:['fc juarez','juarez','bravos'],15720:['atletico san luis','san luis'],
 // Brasil
 819:['flamengo','mengao'],2029:['palmeiras','verdao'],874:['corinthians','timao'],2026:['sao paulo','sao paulo fc'],2674:['santos fc','santos'],3445:['fluminense'],6086:['botafogo'],3454:['vasco','vasco da gama'],
 6273:['gremio'],1936:['internacional','inter de porto alegre','sc internacional'],7632:['atletico mineiro','atletico mg','galo'],2022:['cruzeiro'],3458:['athletico paranaense','athletico pr'],9967:['bahia'],6079:['bragantino','red bull bragantino'],
 // Colombia
 5264:['atletico nacional','nacional de medellin'],5484:['millonarios'],8109:['america de cali','america cali'],2672:['deportivo cali'],4815:['junior','junior de barranquilla','atletico junior'],
 2690:['independiente medellin','medellin','dim'],5488:['santa fe','independiente santa fe'],5489:['tolima','deportes tolima'],2919:['once caldas'],6137:['bucaramanga'],
 // Perú
 2685:['universitario','la u de lima','universitario de deportes'],2680:['alianza lima','alianza'],2673:['sporting cristal','cristal'],7312:['melgar','fbc melgar'],3372:['cienciano'],
 // Ecuador
 2686:['barcelona sc','barcelona de guayaquil','barcelona guayaquil'],2668:['emelec'],4816:['ldu','ldu quito','liga de quito','liga deportiva universitaria'],17086:['independiente del valle','idv'],6017:['aucas'],1011:['delfin'],
 // Copas: Uruguay, Paraguay, Bolivia, Venezuela
 2683:['penarol'],2684:['nacional','club nacional','nacional de montevideo'],2675:['olimpia','club olimpia'],2671:['cerro porteno','cerro'],2670:['libertad','club libertad'],2681:['bolivar'],19425:['always ready'],1007:['defensor','defensor sporting'],5492:['liverpool montevideo','liverpool fc montevideo'],
 // MLS
 20232:['inter miami','inter miami cf'],187:['la galaxy','galaxy'],18966:['lafc','los angeles fc'],186:['sporting kc','sporting kansas city'],190:['new york rb','ny red bulls','new york red bulls','red bulls'],
 191:['sj earthquakes','san jose earthquakes'],193:['dc united','d c united'],17606:['nycfc','new york city'],9720:['montreal','cf montreal'],18418:['atlanta united'],
};
// ESPN English name → Spanish names (first one is the label shown in Spanish).
export const NATION_NAMES={
 'Argentina':['argentina'],'Brazil':['brasil'],'Chile':['chile'],'Uruguay':['uruguay'],'Paraguay':['paraguay'],'Bolivia':['bolivia'],'Peru':['peru'],'Ecuador':['ecuador'],'Colombia':['colombia'],'Venezuela':['venezuela','vinotinto'],
 'Mexico':['mexico','el tri'],'United States':['estados unidos','eeuu','ee uu','usa','usmnt'],'Canada':['canada'],'Costa Rica':['costa rica'],'Honduras':['honduras'],'Panama':['panama'],'Jamaica':['jamaica'],'El Salvador':['el salvador'],'Guatemala':['guatemala'],'Haiti':['haiti'],'Cuba':['cuba'],'Nicaragua':['nicaragua'],'Dominican Republic':['republica dominicana'],'Trinidad and Tobago':['trinidad y tobago'],'Curaçao':['curazao'],'Puerto Rico':['puerto rico'],'Suriname':['surinam'],
 'Spain':['espana','la roja'],'France':['francia'],'Germany':['alemania'],'Italy':['italia'],'England':['inglaterra'],'Portugal':['portugal'],'Netherlands':['paises bajos','holanda'],'Belgium':['belgica'],'Croatia':['croacia'],'Switzerland':['suiza'],'Austria':['austria'],'Denmark':['dinamarca'],
 'Sweden':['suecia'],'Norway':['noruega'],'Finland':['finlandia'],'Iceland':['islandia'],'Poland':['polonia'],'Czechia':['republica checa','chequia'],'Slovakia':['eslovaquia'],'Slovenia':['eslovenia'],'Hungary':['hungria'],'Romania':['rumania'],'Bulgaria':['bulgaria'],'Serbia':['serbia'],
 'Montenegro':['montenegro'],'Bosnia-Herzegovina':['bosnia','bosnia y herzegovina'],'North Macedonia':['macedonia del norte'],'Albania':['albania'],'Kosovo':['kosovo'],'Greece':['grecia'],'Türkiye':['turquia'],'Cyprus':['chipre'],'Ukraine':['ucrania'],'Georgia':['georgia'],'Armenia':['armenia'],'Azerbaijan':['azerbaiyan'],
 'Scotland':['escocia'],'Wales':['gales'],'Northern Ireland':['irlanda del norte'],'Republic of Ireland':['irlanda'],'Israel':['israel'],'Kazakhstan':['kazajistan'],'Luxembourg':['luxemburgo'],'Lithuania':['lituania'],'Latvia':['letonia'],'Estonia':['estonia'],'Moldova':['moldavia'],'Belarus':['bielorrusia'],
 'Malta':['malta'],'Faroe Islands':['islas feroe'],'Andorra':['andorra'],'San Marino':['san marino'],'Liechtenstein':['liechtenstein'],'Gibraltar':['gibraltar'],
 'Japan':['japon'],'South Korea':['corea del sur','corea'],'Australia':['australia'],'Iran':['iran'],'Saudi Arabia':['arabia saudita','arabia saudi'],'Qatar':['catar','qatar'],'Iraq':['irak'],'Jordan':['jordania'],'Uzbekistan':['uzbekistan'],'New Zealand':['nueva zelanda'],
 'Morocco':['marruecos'],'Senegal':['senegal'],'Tunisia':['tunez'],'Algeria':['argelia'],'Egypt':['egipto'],'Ghana':['ghana'],'Ivory Coast':['costa de marfil'],'Cape Verde':['cabo verde'],'South Africa':['sudafrica'],'Congo DR':['rd congo','republica democratica del congo'],
};
