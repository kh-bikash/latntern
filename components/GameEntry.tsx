'use client';
import {useEffect,useState} from 'react';
import WorldApp from './WorldApp';
import FlightApp from './FlightApp';
export default function GameEntry(){const [legacy,setLegacy]=useState<boolean|null>(null);useEffect(()=>setLegacy(new URLSearchParams(location.search).has('flight')),[]);return legacy===null?<div className="flight-loading"><span className="load-ring"/><p>Preparing Hinode</p></div>:legacy?<FlightApp/>:<WorldApp/>;}
