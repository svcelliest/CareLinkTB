<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    /**
     * Province => Municipality => [Barangay, ...], sourced from ACF-Scope.pdf.
     */
    private const TREE = [
        'Aklan' => [
            'Altavas' => ['Cabangila', 'Cabugao', 'Catmon', 'Dalipdip', 'Ginictan', 'Linayasan', 'Lumaynay', 'Lupo', 'Man-up', 'Odiong', 'Poblacion', 'Quinasay-an', 'Talon', 'Tibiao'],
            'Balete' => ['Aranas', 'Arcangel', 'Calizo', 'Cortes', 'Feliciano', 'Fulgencio', 'Guanko', 'Morales', 'Oquendo', 'Poblacion'],
            'Banga' => ['Agbanawan', 'Bacan', 'Badiangan', 'Cerrudo', 'Cupang', 'Daguitan', 'Daja Norte', 'Daja Sur', 'Dingle', 'Jumarap', 'Lapnag', 'Libas', 'Linabuan Sur', 'Mambog', 'Mangan', 'Muguing', 'Pagsanghan', 'Palale', 'Poblacion', 'Polo', 'Polocate', 'San Isidro', 'Sibalew', 'Sigcay', 'Taba-ao', 'Tabayon', 'Tinapuay', 'Torralba', 'Ugsod', 'Venturanza'],
            'Batan' => ['Angas', 'Bay-ang', 'Cabugao', 'Caiyang', 'Camaligan', 'Camanci', 'Ipil', 'Lalab', 'Lupit', 'Magpag-ong', 'Magubahay', 'Mambuquiao', 'Man-up', 'Mandong', 'Napti', 'Palay', 'Poblacion', 'Songcolan', 'Tabon'],
            'Buruanga' => ['Alegria', 'Bagongbayan', 'Balusbos', 'Bel-is', 'Cabugan', 'El Progreso', 'Habana', 'Katipunan', 'Mayapay', 'Nazareth', 'Panilongan', 'Poblacion', 'Santander', 'Tag-osip', 'Tigum'],
            'Ibajay' => ['Agdugayan', 'Antipolo', 'Aparicio', 'Aquino', 'Aslum', 'Bagacay', 'Batuan', 'Buenavista', 'Bugtongbato', 'Cabugao', 'Capilijan', 'Colongcolong', 'Laguinbanua', 'Mabusao', 'Malindog', 'Maloco', 'Mina-a', 'Monlaque', 'Naile', 'Naisud', 'Naligusan', 'Ondoy', 'Poblacion', 'Polo', 'Regador', 'Rivera', 'Rizal', 'San Isidro', 'San Jose', 'Santa Cruz', 'Tagbaya', 'Tul-ang', 'Unat', 'Yawan'],
            'Kalibo' => ['Andagao', 'Bachao Norte', 'Bachao Sur (Bachaw Sur)', 'Briones', 'Buswang New', 'Buswang Old', 'Caano', 'Estancia', 'Linabuan Norte', 'Mabilo', 'Mobo', 'Nalook', 'Poblacion', 'Pook', 'Tigayon', 'Tinigao (Tinigaw)'],
            'Lezo' => ['Agcawilan', 'Bagto', 'Bugasongan', 'Carugdog', 'Cogon', 'Ibao', 'Mina', 'Poblacion (Urban center)', 'Santa Cruz', 'Santa Cruz Biga-a', 'Silakat-Nonok', 'Tayhawan'],
            'Libacao' => ['Alfonso XII', 'Batobato', 'Bonza', 'Calacabian', 'Calamcan', 'Can-Awan', 'Casit-an', 'Dalagsa-an', 'Guadalupe', 'Janlud', 'Julita', 'Luctoga', 'Magugba', 'Manika', 'Ogsip', 'Ortega', 'Oyang', 'Pampango', 'Pinonoy', 'Poblacion', 'Rivera', 'Rosal', 'Sibalew'],
            'Madalag' => ['Alas-as', 'Bacyang', 'Balactasan', 'Cabangahan', 'Cabilawan', 'Catabana', 'Dit-Ana', 'Galicia', 'Guinatu-an', 'Logohon', 'Mamba', 'Maria Cristina', 'Medina', 'Mercedes', 'Napnot', 'Pang-Itan', 'Paningayan', 'Panipiason', 'Poblacion', 'San Jose', 'Singay', 'Talangban', 'Talimagao', 'Tigbawan'],
            'Makato' => ['Agbalogo', 'Aglucay', 'Alibagon', 'Bagong Barrio', 'Baybay', 'Cabatanga', 'Cajilo', 'Calangcang', 'Calimbajan', 'Castillo', 'Cayangwan', 'Dumga', 'Libang', 'Mantiguib', 'Poblacion', 'Tibiawan', 'Tina', 'Tugas'],
            'Malay' => ['Argao', 'Balabag (Boracay)', 'Balusbus', 'Cabulihan', 'Caticlan', 'Cogon', 'Cubay Norte', 'Cubay Sur', 'Dumlog', 'Manoc-Manoc (Boracay)', 'Motag', 'Naasug', 'Nabaoy', 'Napaan', 'Poblacion', 'Sambiray (San Viray)', 'Yapak (Boracay)'],
            'Malinao' => ['Biga-a', 'Bulabud', 'Cabayugan', 'Capataga', 'Cogon', 'Dangcalan', 'Kinalangay Nuevo', 'Kinalangay Viejo', 'Lilo-an', 'Malandayon', 'Manhanip', 'Navitas', 'Osman', 'Poblacion', 'Rosario', 'San Dimas', 'San Ramon', 'San Roque', 'Sipac', 'Sugnod', 'Tambu-an', 'Tigpalas'],
            'Nabas' => ['Alimbo-Baybay', 'Buenasuerte', 'Buenafortuna', 'Buenavista', 'Gibon', 'Habana', 'Laserna', 'Libertad', 'Magallanes', 'Mallocabi', 'Nagalang', 'Panayon', 'Pawa', 'Pinatuad', 'Poblacion', 'Rizal', 'Solido', 'Tagororoc', 'Toledo', 'Unidos', 'Union'],
            'New Washington' => ['Cawayan', 'Dumaguit', 'Fatima', 'Ochando', 'Pinamuk-an', 'Poblacion (Municipal center)', 'Polo', 'Tambak', 'Candelaria', 'Guinbaliwan', 'Jalas', 'Jugas', 'Lawa-an', 'Mabilo', 'Mataphao', 'Puis'],
            'Numancia' => ['Albasan', 'Aliputos', 'Badio', 'Bubog', 'Bulwang', 'Camanci Norte', 'Camanci Sur', 'Dongon East', 'Dongon West', 'Laguinbanua East', 'Laguinbanua West', 'Marianos', 'Navitas', 'Pawa', 'Poblacion', 'Sibalew', 'Tambac'],
            'Tangalan' => ['Afga', 'Baybay', 'Dapdap', 'Dumatad', 'Jawili', 'Lanipga', 'Napatag', 'Panayakan', 'Poblacion', 'Pudiot', 'Tagas', 'Tamalagon', 'Tamokoe (Tamoko)', 'Tondog', 'Vivo'],
        ],
        'Antique' => [
            'Pandan' => ['Aracay', 'Badiangan', 'Bagumbayan', 'Baybay', 'Botbot', 'Buang', 'Cabugao', 'Candari', 'Carmen', 'Centro Norte (Pob.)', 'Centro Sur (Pob.)', 'Dionela', 'Dumrog', 'Duyong', 'Fragante', 'Guia', 'Idiacacan', 'Jinalinan', 'Luhod-Bayang', 'Maadios', 'Mag-aba', 'Napuid', 'Nauring', 'Patria', 'Perfecta', 'San Andres', 'San Joaquin', 'Santa Ana', 'Santa Cruz', 'Santa Fe', 'Santo Rosario', 'Talisay', 'Tingib', 'Zaldivar'],
            'Sebaste' => ['Aguila', 'Alegre', 'Aras-asan', 'Bacalan', 'Callan', 'Idio (Ydio)', 'Nauhon', 'P. Javier', 'Poblacion (Sebaste Proper)'],
            'Libertad' => ['Barusbus', 'Bulanao', 'Centro Este (Pob.)', 'Centro Weste (Pob.)', 'Codiong', 'Cubay', 'Igcagay', 'Inyawan', 'Lindero', 'Maramig', 'Pajo', 'Panangkilon', 'Paz', 'Pucio', 'San Roque', 'Taboc', 'Tinigbas', 'Tinindugan', 'Union'],
        ],
    ];

    public function run(): void
    {
        foreach (self::TREE as $provinceName => $municipalities) {
            $province = Location::updateOrCreate(
                ['parent_id' => null, 'name' => $provinceName],
                ['level' => 'province'],
            );

            foreach ($municipalities as $municipalityName => $barangays) {
                $municipality = Location::updateOrCreate(
                    ['parent_id' => $province->id, 'name' => $municipalityName],
                    ['level' => 'municipality'],
                );

                foreach ($barangays as $barangayName) {
                    Location::updateOrCreate(
                        ['parent_id' => $municipality->id, 'name' => $barangayName],
                        ['level' => 'barangay'],
                    );
                }
            }
        }
    }
}
