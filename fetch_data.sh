curl -s https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/klasyczne-sieci-rrl,9.html | awk -F '"' '/download\// {print $2}' | xargs -L1 -I {} curl -O "https://bip.uke.gov.pl"{}