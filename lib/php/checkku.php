<?php

$ku = $_GET["ku"];
$host = "http://services.cuzk.cz/gml/inspire/cp/epsg-5514/" . $ku . ".zip";
//$host = "http://services.cuzk.cz/gml/inspire/cp/epsg-5514/605841.zip";
// Check to see if the file exists by trying to open it for read only

if (fopen($host, "r")) {
    echo "true";
} else {
    echo "false";
}


?>