export function fixtureResponse(address){
 const action=new URL(address).searchParams.get('action');
 if(!action)return {user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action.endsWith('_categories'))return [{category_id:'1',category_name:'Fixture'}];
 if(action==='get_live_streams')return [{stream_id:12,name:'MLB Fixture Live',category_id:'1'}];
 if(action==='get_vod_streams')return [{stream_id:23,name:'Fixture Movie',category_id:'1',container_extension:'mp4'}];
 if(action==='get_series')return [{series_id:34,name:'Fixture Show',category_id:'1'}];
 if(action==='get_vod_info')return {info:{plot:'Fixture description',duration_secs:600}};
 if(action==='get_series_info')return {episodes:{'2':[{id:90,title:'Fixture Episode 2',episode_num:1,container_extension:'mp4'}],'1':[{id:88,title:'Fixture Episode 1',episode_num:1,container_extension:'mp4'}]}};
 return {};
}
